import { useState } from 'react';
import {
    Modal,
    Input,
    Upload,
    message,
    Button,
    Spin,
    Typography,
    Segmented,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { RcFile } from 'antd/es/upload';
import { extractJson, uploadToGeminiAndGenerateQuiz } from '../utils/api';
import { fixSmartQuotes } from '../utils/repairJson';
import { db } from '../db/db';
import JsonFixerModal from './JsonFixerModal';
import { v4 as uuidv4 } from 'uuid';
import type { QuizQuestion } from '../types';
import { extractTextFromPdf } from '../utils/pdf';

const { Dragger } = Upload;
const { Paragraph, Text, Title } = Typography;

interface Props {
    onClose: () => void;
    onCreated: (id: string) => void;
}

const AddTestModal: React.FC<Props> = ({ onClose, onCreated }) => {
    const [fileName, setFileName] = useState('');
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [manualJson, setManualJson] = useState('');
    const [mode, setMode] = useState<'upload' | 'manual'>('upload');

    const [isUploading, setUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [rawJson, setRawJson] = useState<string | null>(null);

    const handleFileUpload = async (file: RcFile) => {
        if (file.type !== 'application/pdf') {
            message.error('Only PDF files are supported.');
            return false;
        }

        setFileName(file.name.replace(/\.[^/.]+$/, ''));

        try {
            setStatusMessage('Extracting text from PDF...');
            const text = await extractTextFromPdf(file);
            setFileContent(text);
            setStatusMessage(null);
        } catch (err) {
            console.error('[PDF Extraction Error]', err);
            message.error('Failed to extract text from PDF.');
            setStatusMessage(null);
        }

        return false;
    };

    const handleGenerate = async () => {
        setUploading(true);
        setStatusMessage(mode === 'upload' ? 'Uploading file to Gemini...' : 'Parsing pasted JSON...');

        try {
            let parsed: QuizQuestion[] | null = null;

            if (mode === 'upload') {
                if (!fileContent) return;
                const result = await uploadToGeminiAndGenerateQuiz(fileContent);
                setStatusMessage('Cleaning and parsing Gemini response...');
                const fixed = fixSmartQuotes(result);
                parsed = extractJson<QuizQuestion[]>(fixed);

                if (!parsed) {
                    setJsonError('Failed to parse Gemini output');
                    setRawJson(fixed);
                    return;
                }
            } else {
                const fixed = fixSmartQuotes(manualJson);
                parsed = extractJson<QuizQuestion[]>(fixed);

                if (!parsed) {
                    setJsonError('Failed to parse pasted JSON');
                    setRawJson(fixed);
                    return;
                }
            }

            const newId = uuidv4();
            await db.tests.add({
                id: newId,
                name: fileName || 'Untitled Test',
                createdAt: Date.now(),
                questions: parsed,
                attempts: [],
            });

            message.success('Test created!');
            onCreated(newId);
        } catch (err: any) {
            message.error(err.message || 'Something went wrong');
        } finally {
            setUploading(false);
            setStatusMessage(null);
        }
    };

    const canGenerate =
        !isUploading &&
        ((mode === 'upload' && fileContent) || (mode === 'manual' && manualJson.trim()));

    return (
        <>
            <Modal
                open
                onCancel={onClose}
                onOk={handleGenerate}
                okText="Create Test"
                okButtonProps={{ disabled: !canGenerate }}
                confirmLoading={isUploading}
                title="Create a New Quiz"
                centered
                width={600}
                bodyStyle={{ paddingTop: 12 }}
            >
                <div style={{ marginBottom: 24, textAlign: 'center' }}>
                    <Segmented
                        value={mode}
                        onChange={(val) => setMode(val as 'upload' | 'manual')}
                        options={[
                            { label: 'Auto from PDF', value: 'upload' },
                            { label: 'Paste JSON', value: 'manual' },
                        ]}
                        block
                    />
                </div>

                <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Test title"
                    style={{
                        marginBottom: 20,
                        fontSize: 16,
                        borderRadius: 6,
                        padding: '8px 12px',
                    }}
                />

                {mode === 'upload' ? (
                    fileContent ? (
                        <div
                            style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: 8,
                                padding: 16,
                                marginBottom: 20,
                                background: '#f8f8f8',
                                textAlign: 'center',
                            }}
                        >
                            <Text strong>{fileName}.pdf</Text>
                            <Paragraph type="secondary">PDF uploaded and ready.</Paragraph>
                            <Button
                                size="small"
                                danger
                                onClick={() => {
                                    setFileContent(null);
                                    setFileName('');
                                }}
                            >
                                Remove File
                            </Button>
                        </div>
                    ) : (
                        <Dragger
                            beforeUpload={handleFileUpload}
                            showUploadList={false}
                            accept=".pdf"
                            style={{
                                padding: 16,
                                borderRadius: 8,
                                background: '#fafafa',
                            }}
                        >
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p className="ant-upload-text">
                                Click or drag a PDF to upload
                            </p>
                        </Dragger>
                    )
                ) : (
                    <Input.TextArea
                        rows={8}
                        value={manualJson}
                        onChange={(e) => setManualJson(e.target.value)}
                        placeholder="Paste your JSON here..."
                        style={{
                            fontFamily: 'monospace',
                            borderRadius: 8,
                            background: '#f9f9f9',
                        }}
                    />
                )}

                {isUploading && (
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                        <Spin />
                        {statusMessage && (
                            <Paragraph
                                type="secondary"
                                style={{ marginTop: 8 }}
                            >
                                {statusMessage}
                            </Paragraph>
                        )}
                    </div>
                )}
            </Modal>

            {jsonError && rawJson && (
                <JsonFixerModal
                    rawJson={rawJson}
                    errorMessage={jsonError}
                    onTryAgain={(fixedJson) => {
                        try {
                            const parsed: QuizQuestion[] = JSON.parse(fixedJson);
                            const newId = uuidv4();
                            db.tests
                                .add({
                                    id: newId,
                                    name: fileName || 'Untitled Test',
                                    createdAt: Date.now(),
                                    questions: parsed,
                                    attempts: [],
                                })
                                .then(() => {
                                    message.success('Test created after fixing!');
                                    onCreated(newId);
                                });
                        } catch (err) {
                            setJsonError((err as Error).message);
                            setRawJson(fixedJson);
                        }
                    }}
                    onClose={() => {
                        setJsonError(null);
                        setRawJson(null);
                    }}
                />
            )}
        </>
    );
};

export default AddTestModal;

