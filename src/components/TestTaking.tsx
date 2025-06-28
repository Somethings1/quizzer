import { useState, useEffect, useRef } from 'react';
import { StoredTest } from '../db/db';
import { Radio, Button, Checkbox, Typography, Space, Row, Col } from 'antd';

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
    const spacePressedRef = useRef(false);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const q = test.questions[currentIndex];
    const totalCorrect = q.answer.filter((a) => a.correct).length;

    const toggleChoice = (choice: string) => {
        setAnswers((prev) => {
            const prevChoices = prev[currentIndex] || [];
            const exists = prevChoices.includes(choice);

            if (totalCorrect === 1) {
                return { ...prev, [currentIndex]: [choice] };
            }

            const updated = exists
                ? prevChoices.filter((c) => c !== choice)
                : [...prevChoices, choice];

            return { ...prev, [currentIndex]: updated };
        });
    };

    const jumpToQuestion = (number: number) => {
        if (number >= 1 && number <= test.questions.length) {
            setCurrentIndex(number - 1);
        }
    };

    const handleSubmit = async () => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        let score = 0;

        test.questions.forEach((q, idx) => {
            const user = answers[idx] || [];
            const correct = q.answer.filter((a) => a.correct).map((a) => a.content).sort();
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
        const { db } = await import('../db/db');
        await db.tests.put(test);
        onFinish();
    };

    useEffect(() => {
        let buffer = '';
        let bufferTimer: NodeJS.Timeout | null = null;

        const handleKeyDown = (e: KeyboardEvent) => {
            const isDigit = /^[0-9]$/.test(e.key);

            if (spacePressedRef.current) {
                if (isDigit) {
                    buffer += e.key;
                    if (bufferTimer) clearTimeout(bufferTimer);
                    bufferTimer = setTimeout(() => {
                        const target = parseInt(buffer, 10);
                        if (!isNaN(target) && target >= 1 && target <= test.questions.length) {
                            setCurrentIndex(target - 1);
                        }
                        buffer = '';
                        spacePressedRef.current = false;
                    }, 500);
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                spacePressedRef.current = true;
                buffer = '';
                return;
            }

            if (isDigit) {
                const index = parseInt(e.key, 10) - 1;
                if (q.answer[index]) {
                    toggleChoice(q.answer[index].content);
                }
            }

            if (e.key === 'ArrowLeft') {
                setCurrentIndex((i) => Math.max(0, i - 1));
            }

            if (e.key === 'ArrowRight') {
                setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1));
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                // Let buffer expire
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [q, currentIndex]);


    return (
        <Row style={{ width: '100%', height: '100vh', background: '#f9f9f9' }}>
            {/* Left Panel */}
            <Col flex="3" style={{ padding: '64px 48px', background: '#fff' }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 32 }}>
                    <Button
                        type={reviewMarks[currentIndex] ? 'primary' : 'default'}
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
                    <Button type="primary" danger onClick={handleSubmit}>
                        Submit
                    </Button>
                </Row>

                <Paragraph style={{ fontSize: 18 }}>{q.statement}</Paragraph>
                <Paragraph type="secondary" style={{ fontStyle: 'italic' }}>
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
                                <Radio key={idx} value={a.content}>
                                    {idx + 1}. {a.content}
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
                                <Checkbox key={idx} value={a.content}>
                                    {idx + 1}. {a.content}
                                </Checkbox>
                            ))}
                        </Space>
                    </Checkbox.Group>
                )}

                <Row justify="space-between" style={{ marginTop: 64 }}>
                    <Button
                        onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                        disabled={currentIndex === 0}
                    >
                        Previous
                    </Button>
                    <Button
                        onClick={() =>
                            setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1))
                        }
                        disabled={currentIndex === test.questions.length - 1}
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
                        const isCurrent = idx === currentIndex;
                        const bg = marked ? 'gold' : answered ? '#007aff' : '#ccc';
                        const border = isCurrent ? '2px solid #000' : 'none';

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
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: 8,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    border: border,
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

