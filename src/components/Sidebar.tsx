import { useEffect, useRef, useState } from 'react';
import {
    Layout,
    Menu,
    Typography,
    Button,
    message,
    Dropdown,
    Input,
    MenuProps,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { db, StoredTest } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

const { Title } = Typography;

interface Props {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
}

const Sidebar: React.FC<Props> = ({ selectedId, onSelect, onAdd }) => {
    const tests = useLiveQuery(() => db.tests.orderBy('createdAt').reverse().toArray(), []) ?? [];
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; test: StoredTest } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCopyJson = async (test: StoredTest) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(test.questions, null, 2));
            message.success('Copied questions JSON to clipboard');
        } catch (err) {
            console.error(err);
            message.error('Failed to copy questions JSON');
        }
    };

    const handleDownloadJson = (test: StoredTest) => {
        try {
            const blob = new Blob([JSON.stringify(test.questions, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${test.name || 'test'}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            message.error('Failed to download questions JSON');
        }
    };

    const handleRightClick = (e: React.MouseEvent, test: StoredTest) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            test,
        });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const contextMenuItems: MenuProps['items'] = contextMenu
        ? [
            {
                key: 'copy',
                label: 'Copy JSON',
                onClick: () => handleCopyJson(contextMenu.test),
            },
            {
                key: 'download',
                label: 'Download JSON',
                onClick: () => handleDownloadJson(contextMenu.test),
            },
            {
                key: 'rename',
                label: 'Rename',
                onClick: () => {
                    setRenamingId(contextMenu.test.id);
                    setRenameText(contextMenu.test.name);
                    setContextMenu(null);
                },
            },
        ]
        : [];

    return (
        <Layout.Sider width={250} style={{ minWidth: '250px', maxWidth: '250px', background: '#fff' }}>
            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                <div
                    style={{
                        padding: '16px 0',
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: "#000",
                        borderBottom: '1px solid #eee',
                    }}
                >
                    Quizzer
                </div>

                <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                    <Menu
                        mode="inline"
                        selectedKeys={selectedId ? [selectedId] : []}
                        style={{ borderRight: 0 }}
                    >
                        <Menu.Item key="add" icon={<PlusOutlined />} onClick={onAdd}>
                            Add New Test
                        </Menu.Item>

                        {tests.map((test) => {
                            const latest = test.attempts[test.attempts.length - 1];
                            return (
                                <Menu.Item
                                    key={test.id}
                                    onClick={() => onSelect(test.id)}
                                    onContextMenu={(e) => handleRightClick(e, test)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, pointerEvents: 'none' }}>
                                        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {renamingId === test.id ? (
                                                <Input
                                                    size="small"
                                                    autoFocus
                                                    value={renameText}
                                                    onChange={(e) => setRenameText(e.target.value)}
                                                    onBlur={async () => {
                                                        const trimmed = renameText.trim();
                                                        if (trimmed && trimmed !== test.name) {
                                                            await db.tests.update(test.id, { name: trimmed });
                                                            message.success('Renamed');
                                                        }
                                                        setRenamingId(null);
                                                    }}
                                                    onPressEnter={(e) => {
                                                        e.currentTarget.blur();
                                                    }}
                                                />
                                            ) : (
                                                test.name
                                            )}
                                        </span>
                                        <span>{latest ? `${latest.score}/${test.questions.length}` : 'NT'}</span>
                                    </div>
                                </Menu.Item>
                            );
                        })}
                    </Menu>

                    {contextMenu && (
                        <Dropdown
                            open
                            menu={{ items: contextMenuItems }}
                            trigger={['contextMenu']}
                            placement="bottomLeft"
                        >
                            <div
                                style={{
                                    position: 'fixed',
                                    top: contextMenu.y,
                                    left: contextMenu.x,
                                    width: 0,
                                    height: 0,
                                    zIndex: 9999,
                                }}
                            />
                        </Dropdown>
                    )}
                </div>

                <div style={{ padding: 16, borderTop: '1px solid #eee' }}>
                    <Button
                        block
                        danger
                        onClick={async () => {
                            await db.tests.clear();
                            message.success('All tests deleted.');
                        }}
                    >
                        Delete All Tests
                    </Button>
                </div>
            </div>
        </Layout.Sider>
    );
};

export default Sidebar;

