import { useRef, useEffect, useState } from 'react';
import { Button, Typography, Row, Col, Space, Tag } from 'antd';
import { StoredTest } from '../db/db';

const { Title, Paragraph } = Typography;

interface Props {
    test: StoredTest;
    onBack: () => void;
}

const TestReview: React.FC<Props> = ({ test, onBack }) => {
    const latest = test.attempts[test.attempts.length - 1];
    const [currentIndex, setCurrentIndex] = useState(0);

    const q = test.questions[currentIndex];
    const userAnswer = latest.selectedAnswers[currentIndex] || [];

    const correctAnswers = q.answer.filter((a) => a.correct).map((a) => a.content).sort();
    const isCorrect = JSON.stringify([...userAnswer].sort()) === JSON.stringify(correctAnswers);

    const getAnswerTag = (a: typeof q.answer[number]) => {
        const picked = userAnswer.includes(a.content);
        const correct = a.correct;

        let color: string | undefined;
        let prefix = '';

        if (correct && picked) {
            color = 'green';
            prefix = '✓';
        } else if (correct && !picked) {
            color = 'blue';
            prefix = '+';
        } else if (!correct && picked) {
            color = 'red';
            prefix = '✗';
        }

        return (
            <Tag
                color={color}
                style={{
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    maxWidth: '100%',
                    display: 'inline-block', // giữ cho nó behave đúng trong flex
                }}
            >
                {prefix && <strong style={{ marginRight: 4 }}>{prefix}</strong>}
                {a.content}
            </Tag>
        );
    };


    const total = test.questions.length;
    const buffer = useRef('');
    const jumping = useRef(false);
    const timeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!jumping.current) {
                if (e.key === 'ArrowRight') {
                    setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1));
                } else if (e.key === 'ArrowLeft') {
                    setCurrentIndex((i) => Math.max(0, i - 1));
                } else if (e.key === 'ArrowUp') {
                    buffer.current = '';
                    jumping.current = true;
                }
            } else {
                if (/^\d$/.test(e.key)) {
                    buffer.current += e.key;

                    if (timeout.current) clearTimeout(timeout.current);
                    timeout.current = setTimeout(() => {
                        const target = parseInt(buffer.current, 10) - 1;
                        if (!isNaN(target) && target >= 0 && target < test.questions.length) {
                            setCurrentIndex(target);
                        }
                        buffer.current = '';
                        jumping.current = false;
                    }, 500);
                } else if (e.key === 'Escape') {
                    buffer.current = '';
                    jumping.current = false;
                    if (timeout.current) clearTimeout(timeout.current);
                }
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [test.questions.length]);


    return (
        <Row style={{height: '100vh', background: '#fafafa' }}>
            {/* Main Content */}
            <Col flex="3" style={{ padding: '64px 48px', background: '#fff', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
                    <Title level={3} style={{ margin: 0 }}>
                        Question {currentIndex + 1}
                    </Title>
                    <Button onClick={onBack}>Back to Summary</Button>
                </Row>

                <Paragraph style={{ fontSize: 18 }}>{q.statement}</Paragraph>

                <Paragraph type="secondary" style={{ fontStyle: 'italic' }}>
                    Choose {correctAnswers.length} answer{correctAnswers.length > 1 ? 's' : ''}
                </Paragraph>

                <Space direction="vertical" size="middle" style={{ marginTop: 16 }}>
                    {q.answer.map((a, idx) => (
                        <div key={idx}>
                            {getAnswerTag(a)}
                            <div style={{ marginLeft: 8, fontStyle: 'italic', color: '#888' }}>
                                {a.explanation}
                            </div>
                        </div>
                    ))}
                </Space>

                <div style={{ marginTop: 'auto', paddingTop: 32 }}>
                    <Space>
                        <Button
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            disabled={currentIndex === total - 1}
                            onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                        >
                            Next
                        </Button>
                    </Space>
                </div>
            </Col>

            {/* Sidebar */}
            <Col
                flex="1"
                style={{
                    background: '#f5f5f7',
                    padding: 32,
                    borderLeft: '1px solid #ddd',
                    overflowY: 'auto',
                }}
            >
                <Title level={5}>All Questions</Title>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6 }}>
                    {test.questions.map((_, idx) => {
                        const user = latest.selectedAnswers[idx] || [];
                        const correct = test.questions[idx].answer.filter((a) => a.correct).map(a => a.content).sort();
                        const correctMatch = JSON.stringify(user.sort()) === JSON.stringify(correct);

                        return (
                            <div
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                style={{
                                    width: 40,
                                    height: 40,
                                    background: correctMatch ? '#52c41a' : '#ff4d4f',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    border: currentIndex === idx ? '2px solid #000' : '2px solid transparent',
                                    boxSizing: 'border-box',
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

export default TestReview;

