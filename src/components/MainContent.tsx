import { useEffect, useState } from 'react';
import { db, StoredTest } from '../db/db';
import TestStart from './TestStart';
import TestSummary from './TestSummary';
import TestTaking from './TestTaking';
import TestReview from './TestReview';
import { TestSession } from '../types';
import { Button, Typography } from 'antd';

const { Title, Paragraph } = Typography;

interface Props {
    selectedTestId: string | null;
    session: TestSession | null;
    setSession: (s: TestSession | null) => void;
    onAddTest: () => void;
}

const MainContent: React.FC<Props> = ({ selectedTestId, session, setSession, onAddTest }) => {
    const [test, setTest] = useState<StoredTest | null>(null);

    useEffect(() => {
        if (!selectedTestId) {
            setTest(null);
            return;
        }
        db.tests.get(selectedTestId).then(setTest);
    }, [selectedTestId]);

    if (!test) {
        return (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: 32,
                }}
            >
                <Title level={3}>Choose a test from the sidebar</Title>
                <Paragraph>...or create a new one to begin your quiz journey.</Paragraph>
                <Button type="primary" onClick={onAddTest}>
                    Create New Test
                </Button>
            </div>
        );
    }

    const latest = test.attempts[test.attempts.length - 1];

    if (!test.attempts.length && !session) {
        return <TestStart test={test} onStart={() => setSession({ testId: test.id, mode: 'taking' })} />;
    }

    if (session?.mode === 'taking') {
        return <TestTaking test={test} onFinish={() => setSession(null)} />;
    }

    if (session?.mode === 'reviewing') {
        return <TestReview test={test} onBack={() => setSession(null)} />;
    }

    if (!latest && !session) {
        return (
            <TestStart
                test={test}
                onStart={(options) =>
                    setSession({ testId: test.id, mode: 'taking', options })
                }
            />
        );
    }

    return <TestSummary test={test} setSession={setSession} />;
};

export default MainContent;

