import { useState } from 'react';
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

        if (correct && picked) return <Tag color="green">✓ {a.content}</Tag>;
        if (correct && !picked) return <Tag color="blue">+ {a.content}</Tag>;
        if (!correct && picked) return <Tag color="red">✗ {a.content}</Tag>;
        return <Tag>{a.content}</Tag>;
    };

    const questionGrid = (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 4 }}>
            {test.questions.map((_, idx) => {
                const user = latest.selectedAnswers[idx] || [];
                const correct = test.questions[idx].answer.filter((a) => a.correct).map(a => a.content).sort();
                const correctMatch = JSON.stringify(user.sort()) === JSON.stringify(correct);
                return (
                    <div
                        key={idx}
                        style={{
                            background: correctMatch ? 'green' : 'red',
                            width: 40,
                            height: 40,
                            textAlign: 'center',
                            lineHeight: '40px',
                            cursor: 'pointer',
                            borderRadius: 4,
                            color: '#fff'
                        }}
                        onClick={() => setCurrentIndex(idx)}
                    >
                        {idx + 1}
                    </div>
                );
            })}
        </div>
    );

    return (
        <Row style={{ height: '100vh', display: 'flex', width: '100%' }}>
            <Col flex="3" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
                <Title level={4}>Question {currentIndex + 1}</Title>
                <Paragraph>{q.statement}</Paragraph>

                <Paragraph type="secondary" style={{ fontStyle: 'italic' }}>
                    Choose {correctAnswers.length} answer{correctAnswers.length > 1 ? 's' : ''}
                </Paragraph>

                <Space direction="vertical" size="middle">
                    {q.answer.map((a, idx) => (
                        <div key={idx}>
                            {getAnswerTag(a)}
                            <div style={{ marginLeft: 8, fontStyle: 'italic', color: '#888' }}>
                                {a.explanation}
                            </div>
                        </div>
                    ))}
                </Space>
                <div style={{ marginTop: 24 }}>
                    <Space>
                        <Button
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            disabled={currentIndex === test.questions.length - 1}
                            onClick={() => setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1))}
                        >
                            Next
                        </Button>
                    </Space>
                </div>

                <Button style={{ marginTop: 'auto' }} onClick={onBack}>
                    Back to Summary
                </Button>
            </Col>

            <Col
                flex="1"
                style={{
                    background: '#f0f2f5',
                    padding: 24,
                    borderLeft: '1px solid #ddd',
                    height: '100vh',
                    overflowY: 'auto',
                }}
            >
                <Title level={5}>Questions</Title>
                {questionGrid}
            </Col>
        </Row>
    );
};

export default TestReview;

