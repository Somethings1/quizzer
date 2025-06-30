import { useState, useEffect, useRef } from 'react';
import { StoredTest } from '../db/db';
import {
    Radio,
    Button,
    Checkbox,
    Typography,
    Space,
    Row,
    Col,
} from 'antd';

const { Title, Paragraph } = Typography;

interface Props {
    test: StoredTest;
    onFinish: () => void;
    timeLimit?: number; // seconds
}

const TestTaking: React.FC<Props> = ({ test, onFinish, timeLimit }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string[]>>({});
    const [reviewMarks, setReviewMarks] = useState<Record<number, boolean>>({});
    const [shuffledAnswers, setShuffledAnswers] = useState<Record<number, typeof test.questions[0]['answer']>>({});
    const [remaining, setRemaining] = useState<number>(timeLimit ?? 0);
    const startRef = useRef(Date.now());
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const bufferRef = useRef('');
    const spacePressedRef = useRef(false);
    const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

    const q = test.questions[currentIndex];
    const totalCorrect = q.answer.filter((a) => a.correct).length;
    const choices = shuffledAnswers[currentIndex] || [];

    useEffect(() => {
        if (timeLimit) {
            const endTime = startRef.current + timeLimit * 1000;

            timerRef.current = setInterval(() => {
                const now = Date.now();
                const diff = Math.max(0, Math.floor((endTime - now) / 1000));
                setRemaining(diff);

                if (diff <= 0) {
                    clearInterval(timerRef.current!);
                    handleSubmit(); // auto submit
                }
            }, 1000);
        } else {
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - startRef.current) / 1000);
                setRemaining(elapsed);
            }, 1000);
        }

        return () => clearInterval(timerRef.current!);
    }, [timeLimit]);

    useEffect(() => {
        if (!shuffledAnswers[currentIndex]) {
            const shuffled = [...q.answer].sort(() => Math.random() - 0.5);
            setShuffledAnswers((prev) => ({ ...prev, [currentIndex]: shuffled }));
        }
    }, [currentIndex, q.answer, shuffledAnswers]);

    const toggleChoice = (choice: string) => {
        setAnswers((prev) => {
            const prevChoices = prev[currentIndex] || [];

            if (totalCorrect === 1) {
                return { ...prev, [currentIndex]: [choice] };
            }

            const exists = prevChoices.includes(choice);
            const updated = exists
                ? prevChoices.filter((c) => c !== choice)
                : [...prevChoices, choice];

            return { ...prev, [currentIndex]: updated };
        });
    };

    const handleSubmit = async () => {
        const duration = Math.floor((Date.now() - startRef.current) / 1000);
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
        const handleKeyDown = (e: KeyboardEvent) => {
            const isDigit = /^[0-9]$/.test(e.key);

            if (spacePressedRef.current) {
                if (isDigit) {
                    bufferRef.current += e.key;
                    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
                    bufferTimerRef.current = setTimeout(() => {
                        const jumpTo = parseInt(bufferRef.current, 10);
                        if (!isNaN(jumpTo) && jumpTo >= 1 && jumpTo <= test.questions.length) {
                            setCurrentIndex(jumpTo - 1);
                        }
                        bufferRef.current = '';
                        spacePressedRef.current = false;
                    }, 500);
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                spacePressedRef.current = true;
                bufferRef.current = '';
                return;
            }

            if (isDigit) {
                const idx = parseInt(e.key, 10) - 1;
                if (choices[idx]) toggleChoice(choices[idx].content);
            }

            if (e.key === '`') {
                setReviewMarks((prev) => ({
                    ...prev,
                    [currentIndex]: !prev[currentIndex],
                }));
                return;
            }

            if (e.key === 'ArrowLeft') {
                setCurrentIndex((i) => Math.max(0, i - 1));
            }

            if (e.key === 'ArrowRight') {
                setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [choices, test.questions.length]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Row style={{ width: '100%', height: '100vh', background: '#f9f9f9' }}>
            <Col flex="3" style={{ background: '#fff' }}>
                <Row
                    justify="space-between"
                    align="middle"
                    style={{
                        padding: '32px 24px 18px 24px',
                        background: '#f0f2f5',
                        borderBottom: '1px solid #ddd',
                    }}
                >
                    <Title level={4} style={{ margin: 0 }}>
                        {test.name}
                    </Title>
                    <Paragraph style={{ fontSize: 16, margin: 0 }}>
                        {timeLimit
                            ? `Time Left: ${formatTime(remaining)}`
                            : `Elapsed: ${formatTime(remaining)}`}
                    </Paragraph>
                </Row>

                <Row style={{ padding: '34px 30px' }}>
                    <Row justify="space-between" align="middle" style={{ width: '100%', marginBottom: 32 }}>
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
                    <Paragraph type="secondary" style={{ fontStyle: 'italic', width: '100%' }}>
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
                                {choices.map((a, idx) => (
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
                                {choices.map((a, idx) => (
                                    <Checkbox key={idx} value={a.content}>
                                        {idx + 1}. {a.content}
                                    </Checkbox>
                                ))}
                            </Space>
                        </Checkbox.Group>
                    )}

                    <Row justify="space-between" style={{ marginTop: 64, width: '100%' }}>
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

