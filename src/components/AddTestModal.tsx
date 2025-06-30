import { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Input,
    Upload,
    message,
    Button,
    Spin,
    Typography,
    Segmented,
    Tooltip,
} from 'antd';
import { InboxOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { RcFile } from 'antd/es/upload';
import { extractJson, uploadToGeminiAndGenerateQuiz } from '../utils/api';
import { fixSmartQuotes } from '../utils/repairJson';
import { db } from '../db/db';
import JsonFixerModal from './JsonFixerModal';
import { v4 as uuidv4 } from 'uuid';
import type { QuizQuestion } from '../types';
import { extractTextFromPdf } from '../utils/pdf';
import { getMessageApi } from '../utils/messageProvider';

const { Dragger } = Upload;
const { Paragraph, Text } = Typography;

interface Props {
    onClose: () => void;
    onCreated: (id: string) => void;
}

const AddTestModal: React.FC<Props> = ({ onClose, onCreated }) => {
    const [fileName, setFileName] = useState('');
    const [testName, setTestName] = useState('');
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [manualJson, setManualJson] = useState('');
    const [mode, setMode] = useState<'upload' | 'manual'>('upload');

    const [isUploading, setUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [rawJson, setRawJson] = useState<string | null>(null);

    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const message = getMessageApi();

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (startTime) {
            interval = setInterval(() => {
                const newElapsed = Math.floor((Date.now() - startTime) / 1000);
                setElapsed(newElapsed);
                setStatusMessage(mode === 'upload' ? `Thinking (${newElapsed})s` : 'Parsing pasted JSON...');
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [startTime]);

    const handleFileUpload = async (file: RcFile) => {
        setFileName(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isPdf = file.type === 'application/pdf' || ext === 'pdf';
        const isJson = file.type === 'application/json' || ext === 'json';

        if (!isPdf && !isJson) {
            message.error('Only PDF or JSON files are supported.');
            return false;
        }

        setTestName(file.name.replace(/\.[^/.]+$/, ''));

        if (isPdf) {
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
        } else if (isJson) {
            try {
                const text = await file.text();
                const fixed = fixSmartQuotes(text);
                const parsed = extractJson<QuizQuestion[]>(fixed);

                if (!parsed) {
                    setJsonError('Failed to parse uploaded JSON');
                    setRawJson(fixed);
                    return false;
                }

                setManualJson(fixed); // reuse manual flow
                setFileContent(fixed); // just so the create button is enabled
                setStatusMessage(null);
            } catch (err) {
                console.error('[JSON Upload Error]', err);
                message.error('Failed to read JSON file.');
            }
        }

        return false;
    };

    const handleGenerate = async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setUploading(true);
        setStartTime(Date.now());
        setElapsed(0);
        setStatusMessage(mode === 'upload' ? `Thinking (${elapsed})s` : 'Parsing pasted JSON...');

        try {
            let parsed: QuizQuestion[] | null = null;

            if (mode === 'upload') {
                if (!fileContent) return;

                if (manualJson) {
                    // JSON branch
                    const fixed = fixSmartQuotes(manualJson);
                    parsed = extractJson<QuizQuestion[]>(fixed);
                    if (!parsed) {
                        setJsonError('Failed to parse uploaded JSON');
                        setRawJson(fixed);
                        return;
                    }
                } else {
                    // PDF branch
                    const result = await uploadToGeminiAndGenerateQuiz(fileContent, controller.signal);
                    setStatusMessage('Cleaning and parsing response...');
                    const fixed = fixSmartQuotes(result);
                    parsed = extractJson<QuizQuestion[]>(fixed);

                    if (!parsed) {
                        setJsonError('Failed to parse output');
                        setRawJson(fixed);
                        return;
                    }
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
                name: testName || 'Untitled Test',
                createdAt: Date.now(),
                questions: parsed,
                attempts: [],
                fileContent: fileContent || undefined,
            });

            message.success('Test created!');
            onCreated(newId);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                message.warning('Quiz generation was cancelled.');
            } else {
                message.error(err.message || 'Something went wrong');
            }
        } finally {
            setUploading(false);
            setStatusMessage(null);
            setStartTime(null);
            abortControllerRef.current = null;
        }
    };

    const canGenerate =
        !isUploading &&
        ((mode === 'upload' && fileContent) || (mode === 'manual' && manualJson.trim()));

    return (
        <>
            <Modal
                open
                onOk={handleGenerate}
                onCancel={() => {
                    if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                    }
                    onClose();
                }}
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
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Test title"
                    style={{
                        marginBottom: 20,
                        fontSize: 16,
                        borderRadius: 6,
                        padding: '8px 12px',
                    }}
                />

                {mode === 'upload' ? (
                    fileContent || (manualJson && testName) ? (
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
                            <Text strong>{fileName}</Text>
                            <Paragraph type="secondary">File <Text code>{fileName}</Text> is uploaded and ready.</Paragraph>
                            <Button
                                size="small"
                                danger
                                onClick={() => {
                                    setFileContent(null);
                                    setTestName('');
                                }}
                            >
                                Remove File
                            </Button>
                        </div>
                    ) : (
                        <Dragger
                            beforeUpload={handleFileUpload}
                            showUploadList={false}
                            accept=".pdf,.json"
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
                                Click or drag a PDF or JSON file to upload.
                                <Tooltip
                                    title={
                                        <div>
                                            <p>PDF: Extracts questions from text.</p>
                                            <p>JSON: Creates test from exported format.</p>
                                        </div>
                                    }
                                >
                                    <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                </Tooltip>
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
                            <Paragraph type="secondary" style={{ marginTop: 8 }}>
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
                                    name: testName || 'Untitled Test',
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

