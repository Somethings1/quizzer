import { Button, Typography, Checkbox, InputNumber } from 'antd';
import type { StoredTest } from '../db/db';
import { useState } from 'react';

const { Title, Paragraph } = Typography;

interface Props {
    test: StoredTest;
    onStart: (options: { timeLimit?: number }) => void;
}

const TestStart: React.FC<Props> = ({ test, onStart }) => {
    const [timed, setTimed] = useState(false);
    const [durationMinutes, setDurationMinutes] = useState(15); // default to 15 mins

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

            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Checkbox
                    checked={timed}
                    onChange={(e) => setTimed(e.target.checked)}
                    style={{ fontSize: 14 }}
                >
                    Timed test
                </Checkbox>
                {timed && (
                    <InputNumber
                        min={1}
                        max={240}
                        value={durationMinutes}
                        onChange={(val) => setDurationMinutes(val || 1)}
                        addonAfter="minutes"
                        style={{ width: '200px' }}
                    />
                )}
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
                onClick={() =>
                    onStart({
                        timeLimit: timed ? durationMinutes * 60 : undefined,
                    })
                }
            >
                Start Test
            </Button>
        </div>
    );
};

export default TestStart;

