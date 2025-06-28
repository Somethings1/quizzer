import { Button, Typography, Space, Card, Divider, message } from 'antd';
import { StoredTest } from '../db/db';
import { db } from '../db/db';
import { v4 as uuidv4, v4 } from 'uuid';
import shuffle from 'lodash/shuffle';
import { extractJson, uploadToGeminiAndGenerateQuiz } from '../utils/api';
import { fixSmartQuotes } from '../utils/repairJson';
import { QuizQuestion, TestSession } from '../types';
import { useState } from 'react';
import JsonFixerModal from './JsonFixerModal';

const { Title, Paragraph, Text } = Typography;

interface Props {
    test: StoredTest;
    setSession: (s: TestSession) => void;
    onNewTestCreated: (s: string) => void;
}

const TestSummary: React.FC<Props> = ({ test, setSession, onNewTestCreated }) => {
    const latest = test.attempts[test.attempts.length - 1];
    if (!latest) return null;

    const [rawJson, setRawJson] = useState<string | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);


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
            name: `${test.name} (weakness)`,
            createdAt: Date.now(),
            questions: shuffled,
            attempts: [],
        });

        onNewTestCreated(newId);
    };

    const percent = Math.round((latest.score / test.questions.length) * 100);

    return (
        <div style={{ padding: '48px 32px', maxWidth: 700, margin: '0 auto' }}>
            <Card style={{ borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <Title level={3} style={{ marginBottom: 0 }}>{test.name}</Title>
                <Text type="secondary">Summary of your most recent attempt</Text>

                <Divider />

                <Paragraph><strong>Score:</strong> {latest.score} / {test.questions.length}</Paragraph>
                <Paragraph><strong>Accuracy:</strong> {percent}%</Paragraph>
                <Paragraph><strong>Time Taken:</strong> {Math.floor(latest.duration / 60)} min {latest.duration % 60} sec</Paragraph>

                <Divider />

                <Space wrap style={{ marginTop: 24 }}>
                    <Button size="large" onClick={() => setSession({testId: test.id, mode: 'taking'})}>
                        Retake
                    </Button>
                    <Button size="large" onClick={() => setSession({testId: test.id, mode: 'reviewing'})}>
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

