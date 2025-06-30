import { useState } from 'react';
import {
    Button,
    Typography,
    Space,
    Card,
    Divider,
    Timeline,
    Empty,
} from 'antd';
import { StoredTest } from '../db/db';
import { db } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import shuffle from 'lodash/shuffle';
import { extractJson, uploadToGeminiAndGenerateQuiz } from '../utils/api';
import { fixSmartQuotes } from '../utils/repairJson';
import { QuizQuestion, TestSession } from '../types';
import JsonFixerModal from './JsonFixerModal';
import { getMessageApi } from '../utils/messageProvider';

const { Title, Paragraph, Text } = Typography;

interface Props {
    test: StoredTest;
    setSession: (s: TestSession) => void;
    onNewTestCreated: (s: string) => void;
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
};

const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
};


const TestSummary: React.FC<Props> = ({ test, setSession, onNewTestCreated }) => {
    const [rawJson, setRawJson] = useState<string | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const latest = test.attempts[test.attempts.length - 1];
    const message = getMessageApi();

    const handleNewTestSameFile = async () => {
        if (!test.fileContent) {
            message.error('No original file content found. Cannot regenerate.');
            return;
        }

        const key = 'regen';
        message.loading({ content: 'Talking to Gemini…', key });
        setIsLoading(true);

        try {
            const result = await uploadToGeminiAndGenerateQuiz(test.fileContent);
            const fixed = fixSmartQuotes(result);
            const parsed = extractJson<QuizQuestion[]>(fixed);

            if (!parsed) {
                setJsonError('Failed to parse Gemini output');
                setRawJson(fixed);
                message.destroy(key);
                return;
            }

            const newId = uuidv4();
            await db.tests.add({
                id: newId,
                name: `${test.name} (new)`,
                createdAt: Date.now(),
                questions: parsed,
                attempts: [],
                fileContent: test.fileContent,
            });

            message.success({ content: 'New quiz generated!', key });
            onNewTestCreated(newId);

        } catch (err: any) {
            message.error({ content: err.message || 'Something exploded internally', key });
        } finally {
            setIsLoading(false);
        }
    };

    const handleWrongOnlyTest = async () => {
        if (!latest) return;

        const wrongQs = test.questions.filter((q, idx) => {
            const correct = q.answer.filter(a => a.correct).map(a => a.content).sort();
            const chosen = latest.selectedAnswers[idx]?.sort() || [];
            return JSON.stringify(correct) !== JSON.stringify(chosen);
        });

        if (!wrongQs.length) {
            message.info('You got everything right, Einstein.');
            return;
        }

        const newId = uuidv4();
        const shuffled = wrongQs.map(q => ({
            ...q,
            answer: shuffle(q.answer),
        }));

        await db.tests.add({
            id: newId,
            name: `${test.name} (mistakes)`,
            createdAt: Date.now(),
            questions: shuffled,
            attempts: [],
        });

        onNewTestCreated(newId);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                padding: '50px 16px',
                maxWidth: '100%',
                height: '100%',
                overflow: 'hidden',
                gap: 24,
            }}
        >
            {/* Left: Summary Card */}
            <div style={{ flex: 1, minWidth: 300, display: 'flex', justifyContent: 'center' }}>
                <Card
                    style={{
                        borderRadius: 12,
                        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
                        height: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                    bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}
                >
                    <Title level={3} style={{ marginBottom: 8 }}>{test.name}</Title>
                    <Text type="secondary">Latest attempt</Text>
                    <Divider style={{ margin: '16px 0' }} />

                    {latest ? (
                        <div style={{ marginBottom: 24, width: 600, marginInline: 'auto' }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    rowGap: 24,
                                    columnGap: 50,
                                }}
                            >
                                {/* Score */}
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        Score
                                    </Text>
                                    <div style={{ fontSize: 36, fontWeight: 600 }}>
                                        {latest.score}/{test.questions.length}
                                    </div>
                                </div>

                                {/* Accuracy */}
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        Accuracy
                                    </Text>
                                    <div style={{ fontSize: 36, fontWeight: 600 }}>
                                        {Math.round((latest.score / test.questions.length) * 100)}%
                                    </div>
                                </div>

                                {/* Duration */}
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        Duration
                                    </Text>
                                    <div style={{ fontSize: 36, fontWeight: 600 }}>
                                        {Math.floor(latest.duration / 60)}m {latest.duration % 60}s
                                    </div>
                                </div>

                                {/* Taken at */}
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        Time
                                    </Text>
                                    <div style={{ fontSize: 28, fontWeight: 600 }}>
                                        {formatTime(latest.time)}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        {formatDate(latest.time)}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Paragraph>No attempts yet.</Paragraph>
                    )}

                    <Divider style={{ marginTop: 'auto' }} />

                    <Space wrap style={{ justifyContent: 'center' }} size='large'>
                        <Button size="large" onClick={() => setSession({ testId: test.id, mode: 'taking' })}>
                            Retake
                        </Button>
                        <Button size="large" onClick={() => setSession({ testId: test.id, mode: 'reviewing' })}>
                            Review
                        </Button>
                        <Button size="large" loading={isLoading} onClick={handleNewTestSameFile}>
                            New Test (same file)
                        </Button>
                        <Button size="large" onClick={handleWrongOnlyTest}>
                            Focus on Mistakes
                        </Button>
                    </Space>
                </Card>
            </div>

            {/* Right: Timeline */}
            <div
                style={{
                    width: 280,
                    maxHeight: '100%',
                    overflowY: 'auto',
                    paddingRight: 8,
                    borderLeft: '1px solid #f0f0f0',
                }}
            >

                <Title level={5} style={{ marginTop: 0 }}>History</Title>
                {test.attempts.length === 0 ? (
                    <Empty description="No attempts" />
                ) : (
                    <Timeline style={{ marginTop: 12 }}>
                        {test.attempts
                            .slice()
                            .reverse()
                            .map((attempt) => (
                                <Timeline.Item key={attempt.id}>
                                    <Text style={{ fontWeight: 800 }}>{formatDate(attempt.time)}</Text>
                                    <Paragraph style={{ margin: '4px 20px' }}>
                                        Score: {attempt.score}/{test.questions.length} <br />
                                        Time: {Math.floor(attempt.duration / 60)}m {attempt.duration % 60}s
                                    </Paragraph>
                                </Timeline.Item>
                            ))}
                    </Timeline>
                )}
            </div>

            {/* JSON Fixer Modal */}
            {jsonError && rawJson && (
                <JsonFixerModal
                    rawJson={rawJson}
                    errorMessage={jsonError}
                    onTryAgain={async (fixedJson) => {
                        try {
                            const parsed: QuizQuestion[] = JSON.parse(fixedJson);
                            const newId = uuidv4();

                            await db.tests.add({
                                id: newId,
                                name: `${test.name} (fixed)`,
                                createdAt: Date.now(),
                                questions: parsed,
                                attempts: [],
                                fileContent: test.fileContent,
                            });

                            message.success('Quiz fixed and created!');
                            onNewTestCreated(newId);
                            setRawJson(null);
                            setJsonError(null);
                        } catch (err) {
                            setJsonError((err as Error).message);
                            setRawJson(fixedJson);
                        }
                    }}
                    onClose={() => {
                        setRawJson(null);
                        setJsonError(null);
                    }}
                />
            )}
        </div>
    );
};

export default TestSummary;

