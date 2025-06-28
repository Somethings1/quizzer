import { Button, Typography, Space, Card, Divider, message } from 'antd';
import { StoredTest } from '../db/db';
import { db } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import shuffle from 'lodash/shuffle';

const { Title, Paragraph, Text } = Typography;

interface Props {
  test: StoredTest;
  setSession: (s: { testId: string; mode: 'taking' | 'reviewing' }) => void;
}

const TestSummary: React.FC<Props> = ({ test, setSession }) => {
  const latest = test.attempts[test.attempts.length - 1];
  if (!latest) return null;

  const handleCloneAndRetake = async () => {
    const newId = uuidv4();
    const cloned = cloneDeep(test.questions).map(q => ({
      ...q,
      answer: shuffle(q.answer),
    }));

    await db.tests.add({
      id: newId,
      name: `${test.name} (new)`,
      createdAt: Date.now(),
      questions: shuffle(cloned),
      attempts: [],
    });

    setSession({ testId: newId, mode: 'taking' });
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

    setSession({ testId: newId, mode: 'taking' });
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
          <Button size="large" onClick={() => setSession({ testId: test.id, mode: 'taking' })}>
            Retake
          </Button>
          <Button size="large" onClick={() => setSession({ testId: test.id, mode: 'reviewing' })}>
            Review
          </Button>
          <Button size="large" onClick={handleCloneAndRetake}>
            New Test (same file)
          </Button>
          <Button size="large" onClick={handleWrongOnlyTest}>
            Focus on Mistakes
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default TestSummary;

