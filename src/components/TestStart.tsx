import { Button, Typography, Checkbox } from 'antd';
import type { StoredTest } from '../db/db';
import { useState } from 'react';

const { Title, Paragraph } = Typography;

interface Props {
    test: StoredTest;
    onStart: (options: { instantFeedback: boolean }) => void;
}

const TestStart: React.FC<Props> = ({ test, onStart }) => {
    const [instantFeedback, setInstantFeedback] = useState(false);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                margin: '0 auto',
                padding: '64px 24px',
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Title level={2} style={{ marginBottom: 8 }}>
                {test.name}
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 32 }}>
                This test contains <strong>{test.questions.length}</strong> questions
            </Paragraph>

            <div style={{ marginBottom: 32 }}>
                <Checkbox
                    checked={instantFeedback}
                    onChange={(e) => setInstantFeedback(e.target.checked)}
                    style={{ fontSize: 14 }}
                >
                    Show explanations immediately
                </Checkbox>
            </div>

            <Button
                type="primary"
                size="large"
                style={{
                    borderRadius: 24,
                    padding: '0 36px',
                    height: 48,
                    width: 150,
                    fontSize: 16,

                }}
                onClick={() => onStart({ instantFeedback })}
            >
                Start Test
            </Button>
        </div>
    );
};

export default TestStart;

