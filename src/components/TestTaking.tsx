import { useState, useEffect } from 'react';
import { StoredTest } from '../db/db';
import {
    Radio,
    Button,
    Checkbox,
    Typography,
    Space,
    Row,
    Col,
    Tag,
} from 'antd';

const { Title, Paragraph } = Typography;

interface Props {
    test: StoredTest;
    onFinish: () => void;
}

const TestTaking: React.FC<Props> = ({ test, onFinish }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string[]>>({});
    const [reviewMarks, setReviewMarks] = useState<Record<number, boolean>>({});
    const [startTime] = useState(Date.now());

    const q = test.questions[currentIndex];

    const handleToggleChoice = (content: string) => {
        setAnswers((prev) => {
            const prevChoices = prev[currentIndex] || [];
            const exists = prevChoices.includes(content);
            const updated = exists
                ? prevChoices.filter((c) => c !== content)
                : [...prevChoices, content];
            return { ...prev, [currentIndex]: updated };
        });
    };

    const handleSubmit = async () => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        let score = 0;

        test.questions.forEach((q, idx) => {
            const user = answers[idx] || [];
            const correct = q.answer
                .filter((a) => a.correct)
                .map((a) => a.content)
                .sort();
            const userSorted = [...user].sort();
            if (JSON.stringify(correct) === JSON.stringify(userSorted)) score++;
        });

        const attempt = {
            id: String(Date.now()),
            time: Date.now(),
            duration,
            selectedAnswers: answers,
            score,
        };

        await test.attempts.push(attempt);
        await indexedDBPutTest(test);
        onFinish();
    };

    const indexedDBPutTest = async (updated: StoredTest) => {
        const { db } = await import('../db/db');
        await db.tests.put(updated);
    };

    const totalCorrect = q.answer.filter((a) => a.correct).length;

    return (
        <Row style={{ width: '100%', height: '100vh', background: '#f9f9f9' }}>
            {/* Left/Main panel */}
            <Col flex="3" style={{ padding: '64px 48px', background: '#fff' }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 32 }}>
                    <Button
                        type={reviewMarks[currentIndex] ? 'primary' : 'default'}
                        style={{
                            borderRadius: 24,
                            padding: '0 20px',
                            height: 40,
                            backgroundColor: reviewMarks[currentIndex] ? '#ffcc00' : undefined,
                            color: reviewMarks[currentIndex] ? '#000' : undefined,
                            borderColor: reviewMarks[currentIndex] ? '#ffcc00' : undefined,
                        }}
                        onClick={() =>
                            setReviewMarks((prev) => ({
                                ...prev,
                                [currentIndex]: !prev[currentIndex],
                            }))
                        }
                    >
                        {reviewMarks[currentIndex] ? '✓ Marked' : 'Mark for Review'}
                    </Button>
                    <Title level={3} style={{ margin: 0 }}>
                        Question {currentIndex + 1}
                    </Title>
                    <Button
                        type="primary"
                        danger
                        onClick={handleSubmit}
                        style={{ borderRadius: 24, padding: '0 24px', height: 40 }}
                    >
                        Submit
                    </Button>
                </Row>

                <Paragraph style={{ fontSize: 18 }}>{q.statement}</Paragraph>

                <Paragraph type="secondary" style={{ fontStyle: 'italic', marginBottom: 24 }}>
                    Choose {totalCorrect} answer{totalCorrect > 1 ? 's' : ''}
                </Paragraph>

                {totalCorrect === 1 ? (
                    <Radio.Group
                        value={(answers[currentIndex] && answers[currentIndex][0]) || null}
                        onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [currentIndex]: [e.target.value] }))
                        }
                    >
                        <Space direction="vertical" size="large">
                            {q.answer.map((a, idx) => (
                                <Radio value={a.content} key={idx} style={{ fontSize: 16 }}>
                                    {a.content}
                                </Radio>
                            ))}
                        </Space>
                    </Radio.Group>
                ) : (
                    <Checkbox.Group
                        value={answers[currentIndex] || []}
                        onChange={(vals) =>
                            setAnswers((prev) => ({ ...prev, [currentIndex]: vals as string[] }))
                        }
                    >
                        <Space direction="vertical" size="large">
                            {q.answer.map((a, idx) => (
                                <Checkbox value={a.content} key={idx} style={{ fontSize: 16 }}>
                                    {a.content}
                                </Checkbox>
                            ))}
                        </Space>
                    </Checkbox.Group>
                )}

                <Row justify="space-between" style={{ marginTop: 64 }}>
                    <Button
                        onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                        disabled={currentIndex === 0}
                        style={{ borderRadius: 24, padding: '0 24px', height: 40 }}
                    >
                        Previous
                    </Button>
                    <Button
                        type="primary"
                        onClick={() => setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1))}
                        disabled={currentIndex === test.questions.length - 1}
                        style={{ borderRadius: 24, padding: '0 24px', height: 40 }}
                    >
                        Next
                    </Button>
                </Row>
            </Col>

            {/* Sidebar */}
            <Col
                flex="1"
                style={{
                    background: '#f5f5f7',
                    padding: '48px 24px',
                    borderLeft: '1px solid #ddd',
                    overflowY: 'auto',
                }}
            >
                <Title level={5}>All Questions</Title>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, 40px)',
                        gap: 6,
                    }}
                >
                    {test.questions.map((_, idx) => {
                        const answered = !!answers[idx]?.length;
                        const marked = reviewMarks[idx];
                        const bg = marked ? 'gold' : answered ? '#007aff' : '#ccc';
                        return (
                            <div
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                style={{
                                    width: 40,
                                    height: 40,
                                    background: bg,
                                    color: '#fff',
                                    textAlign: 'center',
                                    lineHeight: '40px',
                                    borderRadius: 8,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                {idx + 1}
                            </div>
                        );
                    })}
                </div>
            </Col>
        </Row>
    );
};

export default TestTaking;

