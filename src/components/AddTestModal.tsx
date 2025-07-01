import { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Input,
    Upload,
    Button,
    Spin,
    Typography,
    Tabs,
    Tooltip,
    List,
    Tag,
    Space,
} from 'antd';
import {
    InboxOutlined,
    InfoCircleOutlined,
    EditOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    CloseCircleOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
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

// --- TYPE DEFINITIONS ---
type FileStatus = 'uploading' | 'thinking' | 'error' | 'ready';

interface UploadedFile {
    id: string;
    file: RcFile;
    testName: string;
    status: FileStatus;
    elapsedTime: number;
    errorMessage?: string;
    rawJson?: string;
    questions?: QuizQuestion[];
    abortController?: AbortController;
    timerId?: NodeJS.Timeout;
}

interface Props {
    onClose: () => void;
    onCreated: (id: string) => void;
}

// --- MAIN COMPONENT ---
const AddTestModal: React.FC<Props> = ({ onClose, onCreated }) => {
    const [activeTab, setActiveTab] = useState<'separate' | 'multiple'>('separate');
    const message = getMessageApi();

    // --- State for "Separate files" Tab ---
    const [fileList, setFileList] = useState<UploadedFile[]>([]);
    const [fixingFile, setFixingFile] = useState<UploadedFile | null>(null);

    // --- State for "Multiple files at once" Tab ---
    const [multiplePdfs, setMultiplePdfs] = useState<RcFile[]>([]);
    const [multipleTestName, setMultipleTestName] = useState('');
    const [isProcessingMultiple, setProcessingMultiple] = useState(false);
    const [multipleStatusMsg, setMultipleStatusMsg] = useState<string | null>(null);
    const [multipleJsonError, setMultipleJsonError] = useState<string | null>(null);
    const [multipleRawJson, setMultipleRawJson] = useState<string | null>(null);
    const [multipleStartTime, setMultipleStartTime] = useState<number | null>(null);
    const [multipleElapsed, setMultipleElapsed] = useState<number>(0);
    const multipleAbortControllerRef = useRef<AbortController | null>(null);

    // Timer effect for "Multiple files" tab
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (multipleStartTime) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - multipleStartTime) / 1000);
                setMultipleElapsed(elapsed);
                setMultipleStatusMsg(`Thinking (${elapsed}s)`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [multipleStartTime]);


    // --- Helper Functions for "Separate files" Tab ---
    const updateFileState = (id: string, updates: Partial<UploadedFile>) => {
        setFileList(prev =>
            prev.map(f => (f.id === id ? { ...f, ...updates } : f))
        );
    };

    const startFileTimer = (id: string) => {
        const timerId = setInterval(() => {
            setFileList(prevList =>
                prevList.map(item =>
                    item.id === id
                        ? { ...item, status: 'thinking', elapsedTime: item.elapsedTime + 1 }
                        : item
                )
            );
        }, 1000);
        updateFileState(id, { timerId });
    };

    const stopFileTimer = (id: string) => {
        setFileList(prev => {
            const file = prev.find(f => f.id === id);
            if (file?.timerId) {
                clearInterval(file.timerId);
            }
            return prev.map(f =>
                f.id === id ? { ...f, timerId: undefined, elapsedTime: 0 } : f
            );
        });
    };

    // =================================================================
    // THIS IS THE CORRECTED FUNCTION
    // =================================================================
    const processFile = async (fileToProcess: UploadedFile) => {
        const { id, file } = fileToProcess;
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isPdf = file.type === 'application/pdf' || ext === 'pdf';
        const isJson = file.type === 'application/json' || ext === 'json';

        if (!isPdf && !isJson) {
            updateFileState(id, { status: 'error', errorMessage: 'Unsupported file type.' });
            return;
        }

        updateFileState(id, { status: 'uploading' });

        try {
            const fileText = await (isPdf ? extractTextFromPdf(file) : file.text());

            if (isJson) {
                const fixedJson = fixSmartQuotes(fileText);
                const parsed = extractJson<QuizQuestion[]>(fixedJson);
                if (parsed) {
                    updateFileState(id, { status: 'ready', questions: parsed });
                } else {
                    // Correctly set rawJson for bad user-uploaded JSON
                    updateFileState(id, { status: 'error', errorMessage: 'Invalid JSON format', rawJson: fixedJson });
                }
            } else { // isPdf
                const controller = new AbortController();
                updateFileState(id, { abortController: controller, status: 'thinking' });
                startFileTimer(id);

                const resultText = await uploadToGeminiAndGenerateQuiz(fileText, controller.signal);
                stopFileTimer(id);

                const fixedResult = fixSmartQuotes(resultText);
                const parsedResult = extractJson<QuizQuestion[]>(fixedResult);

                if (parsedResult) {
                    updateFileState(id, { status: 'ready', questions: parsedResult, rawJson: undefined, errorMessage: undefined });
                } else {
                    // **THE FIX**: When parsing fails, save the 'fixedResult' as rawJson
                    updateFileState(id, { status: 'error', errorMessage: 'AI response was not valid JSON.', rawJson: fixedResult });
                }
            }
        } catch (err: any) {
            stopFileTimer(id);
            if (err.name === 'AbortError') {
                updateFileState(id, { status: 'error', errorMessage: 'Cancelled' });
            } else {
                // Also handle generic errors by setting the state to 'error'
                updateFileState(id, { status: 'error', errorMessage: err.message || 'An unknown error occurred.' });
            }
        }
    };

    const handleSeparateUpload = (file: RcFile) => {
        const newFile: UploadedFile = {
            id: uuidv4(),
            file,
            testName: file.name.replace(/\.[^/.]+$/, ''),
            status: 'uploading',
            elapsedTime: 0,
        };
        setFileList(prev => [...prev, newFile]);
        processFile(newFile);
        return false; // Prevent antd default upload
    };

    const handleRemoveFile = (id: string) => {
        const file = fileList.find(f => f.id === id);
        file?.abortController?.abort();
        if (file?.timerId) clearInterval(file.timerId);
        setFileList(prev => prev.filter(f => f.id !== id));
    };

    const handleFixFile = (file: UploadedFile) => {
        setFixingFile(file);
    };

    // --- Handler for "Multiple files" Tab ---
    const handleMultipleUpload = (file: RcFile) => {
        setMultiplePdfs(prev => [...prev, file]);
        if (!multipleTestName) {
            setMultipleTestName('Combined Quiz');
        }
        return false;
    };

    const handleRemoveMultiplePdf = (fileToRemove: RcFile) => {
        setMultiplePdfs(prev => prev.filter(file => file.uid !== fileToRemove.uid));
    }

    // --- MAIN ACTION HANDLERS ---
    const handleCreate = async () => {
        if (activeTab === 'separate') {
            const readyFiles = fileList.filter(f => f.status === 'ready');
            if (readyFiles.length === 0) return;

            let firstId = '';
            for (const file of readyFiles) {
                const newId = uuidv4();
                if (!firstId) firstId = newId;
                await db.tests.add({
                    id: newId,
                    name: file.testName || 'Untitled Test',
                    createdAt: Date.now(),
                    questions: file.questions!,
                    attempts: [],
                });
            }
            message.success(`${readyFiles.length} test(s) created!`);
            onCreated(firstId);
        } else { // Multiple files tab
            multipleAbortControllerRef.current = new AbortController();
            setProcessingMultiple(true);
            setMultipleStartTime(Date.now());
            setMultipleElapsed(0);

            try {
                setMultipleStatusMsg('Extracting text from PDFs...');
                const allTexts = await Promise.all(
                    multiplePdfs.map(file => extractTextFromPdf(file))
                );
                const combinedText = allTexts.join('\n\n---\n\n');

                setMultipleStatusMsg(`Thinking (${multipleElapsed}s)`);
                const result = await uploadToGeminiAndGenerateQuiz(combinedText, multipleAbortControllerRef.current.signal);
                setMultipleStatusMsg('Cleaning and parsing response...');
                const fixed = fixSmartQuotes(result);
                const parsed = extractJson<QuizQuestion[]>(fixed);

                if (!parsed) {
                    setMultipleJsonError('Failed to parse output');
                    setMultipleRawJson(fixed);
                    setProcessingMultiple(false);
                    setMultipleStartTime(null);
                    return;
                }

                const newId = uuidv4();
                await db.tests.add({
                    id: newId,
                    name: multipleTestName || 'Untitled Combined Test',
                    createdAt: Date.now(),
                    questions: parsed,
                    attempts: [],
                    fileContent: combinedText,
                });
                message.success('Combined test created!');
                onCreated(newId);

            } catch (err: any) {
                 if (err.name === 'AbortError') {
                    message.warning('Quiz generation was cancelled.');
                } else {
                    message.error(err.message || 'Something went wrong');
                }
            } finally {
                setProcessingMultiple(false);
                setMultipleStatusMsg(null);
                setMultipleStartTime(null);
                multipleAbortControllerRef.current = null;
            }
        }
    };

    const handleCancel = () => {
        fileList.forEach(file => {
            file.abortController?.abort();
            if (file.timerId) clearInterval(file.timerId);
        });
        multipleAbortControllerRef.current?.abort();
        onClose();
    };

    // --- RENDER LOGIC ---
    const renderStatus = (file: UploadedFile) => {
        switch (file.status) {
            case 'uploading':
                return <Tag icon={<SyncOutlined spin />} color="processing">Processing</Tag>;
            case 'thinking':
                return <Tag icon={<SyncOutlined spin />} color="processing">Thinking ({file.elapsedTime}s)</Tag>;
            case 'error':
                return (
                    <Tooltip title={file.errorMessage}>
                        <Tag icon={<ExclamationCircleOutlined />} color="error">Error</Tag>
                    </Tooltip>
                );
            case 'ready':
                return <Tag icon={<CheckCircleOutlined />} color="success">Ready</Tag>;
            default:
                return null;
        }
    };

    const separateTab = (
        <div>
            <Dragger
                multiple
                beforeUpload={handleSeparateUpload}
                showUploadList={false}
                accept=".pdf,.json"
                style={{ padding: 16, borderRadius: 8, background: '#fafafa', marginBottom: 20 }}
            >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">
                    Click or drag PDF or JSON files here
                    <Tooltip title={<div><p>PDF: Extracts questions from text.</p><p>JSON: Creates test from exported format.</p></div>}>
                        <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                </p>
            </Dragger>
            <List
                style={{ maxHeight: 300, overflowY: 'auto' }}
                dataSource={fileList}
                renderItem={(item) => (
                    <List.Item
                        actions={[
                            <Space>
                                {item.status === 'error' && item.rawJson && (
                                    <Button size="small" type="primary" onClick={() => handleFixFile(item)}>Fix</Button>
                                )}
                                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleRemoveFile(item.id)} />
                            </Space>
                        ]}
                    >
                        <List.Item.Meta
                            avatar={item.file.type === 'application/pdf' ? <FilePdfOutlined /> : <FileTextOutlined />}
                            title={
                                <Text editable={{
                                    onChange: (newText) => updateFileState(item.id, { testName: newText }),
                                    icon: <EditOutlined style={{ marginLeft: 8 }}/>
                                }}>
                                    {item.testName}
                                </Text>
                            }
                            description={renderStatus(item)}
                        />
                    </List.Item>
                )}
                locale={{ emptyText: 'Upload files to get started' }}
            />
        </div>
    );

    const multipleTab = (
        <div>
             <Input
                value={multipleTestName}
                onChange={(e) => setMultipleTestName(e.target.value)}
                placeholder="Enter a title for the combined test"
                style={{ marginBottom: 20, fontSize: 16, borderRadius: 6, padding: '8px 12px' }}
                disabled={isProcessingMultiple}
            />
            <Dragger
                multiple
                beforeUpload={handleMultipleUpload}
                showUploadList={false}
                accept=".pdf"
                disabled={isProcessingMultiple}
                style={{ padding: 16, borderRadius: 8, background: '#fafafa' }}
            >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">Click or drag multiple PDF files to combine</p>
            </Dragger>

            {multiplePdfs.length > 0 && (
                <List
                    size="small"
                    header={<div>{multiplePdfs.length} file(s) ready to be combined:</div>}
                    dataSource={multiplePdfs}
                    renderItem={item => (
                        <List.Item actions={!isProcessingMultiple ? [<Button type="text" danger size="small" icon={<CloseCircleOutlined/>} onClick={() => handleRemoveMultiplePdf(item)}/>] : []}>
                            <Text><FilePdfOutlined style={{marginRight: 8}}/> {item.name}</Text>
                        </List.Item>
                    )}
                    style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto'}}
                />
            )}

            {isProcessingMultiple && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Spin />
                    {multipleStatusMsg && (
                        <Paragraph type="secondary" style={{ marginTop: 8 }}>
                            {multipleStatusMsg}
                        </Paragraph>
                    )}
                </div>
            )}
        </div>
    );

    const readyToCreateSeparate = fileList.some(f => f.status === 'ready');
    const createdCount = fileList.filter(f => f.status === 'ready').length;
    const okText = activeTab === 'separate' ? `Create ${createdCount} Test(s)` : 'Create Combined Test';
    const isOkDisabled = activeTab === 'separate' ? !readyToCreateSeparate : !(multiplePdfs.length > 0 && multipleTestName && !isProcessingMultiple);

    return (
        <>
            <Modal
                open
                onOk={handleCreate}
                onCancel={handleCancel}
                okText={okText}
                okButtonProps={{ disabled: isOkDisabled }}
                confirmLoading={activeTab === 'multiple' && isProcessingMultiple}
                title="Create a New Quiz"
                centered
                width={600}
                styles={{ body: { paddingTop: 12 } }}
            >
                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as any)}>
                    <Tabs.TabPane tab="Separate files" key="separate">
                        {separateTab}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Multiple files at once" key="multiple">
                        {multipleTab}
                    </Tabs.TabPane>
                </Tabs>
            </Modal>

            {fixingFile && (
                <JsonFixerModal
                    rawJson={fixingFile.rawJson!}
                    errorMessage={fixingFile.errorMessage!}
                    onFixed={(fixedJson) => {
                        try {
                            const parsed = JSON.parse(fixedJson) as QuizQuestion[];
                            if(!Array.isArray(parsed)) throw new Error("JSON is not an array.");

                            updateFileState(fixingFile.id, {
                                status: 'ready',
                                questions: parsed,
                                rawJson: undefined,
                                errorMessage: undefined,
                            });
                            setFixingFile(null);
                            message.success(`Test '${fixingFile.testName}' is now ready.`);
                        } catch (err) {
                            setFixingFile(prev => ({
                                ...prev!,
                                rawJson: fixedJson,
                                errorMessage: `Still invalid: ${(err as Error).message}`
                            }));
                        }
                    }}
                    onClose={() => setFixingFile(null)}
                />
            )}

            {multipleJsonError && multipleRawJson && (
                <JsonFixerModal
                    rawJson={multipleRawJson}
                    errorMessage={multipleJsonError}
                    onFixed={async (fixedJson) => {
                        try {
                            const parsed = JSON.parse(fixedJson) as QuizQuestion[];
                            const newId = uuidv4();
                            await db.tests.add({
                                id: newId,
                                name: multipleTestName || 'Untitled Combined Test',
                                createdAt: Date.now(),
                                questions: parsed,
                                attempts: [],
                            });
                            message.success('Test created after fixing!');
                            onCreated(newId);
                        } catch (err) {
                            setMultipleJsonError((err as Error).message);
                            setMultipleRawJson(fixedJson);
                        }
                    }}
                    onClose={() => {
                        setMultipleJsonError(null);
                        setMultipleRawJson(null);
                    }}
                />
            )}
        </>
    );
};

export default AddTestModal;
