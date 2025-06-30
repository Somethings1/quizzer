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
    Checkbox,
    Popconfirm,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { db, StoredTest } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMessageApi } from '../utils/messageProvider';

const { Title } = Typography;

interface Props {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onAdd: () => void;
}

const Sidebar: React.FC<Props> = ({ selectedId, onSelect, onAdd }) => {
    const tests = useLiveQuery(() => db.tests.orderBy('createdAt').reverse().toArray(), []) ?? [];

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        test: StoredTest;
    } | null>(null);

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const message = getMessageApi();

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
        if (selectMode) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, test });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleToggleSelection = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === tests.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(tests.map((t) => t.id));
        }
    };

    const contextMenuItems: MenuProps['items'] = contextMenu
        ? [
            {
                key: 'select',
                label: 'Select',
                onClick: () => {
                    setSelectMode(true);
                    setSelectedIds([contextMenu.test.id]);
                    setContextMenu(null);
                },
            },
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
            {
                key: 'delete',
                label: 'Delete',
                danger: true,
                onClick: () => {
                    db.tests.delete(contextMenu.test.id).then(() => {
                        message.success('Deleted test');
                        if (selectedId === contextMenu.test.id) {
                            onSelect(null);
                        }
                    });
                },
            },
        ]
        : [];

    return (
        <Layout.Sider width={250} style={{ background: '#fff' }}>
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div
                    style={{
                        padding: '26px 0 10px 0',
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: '#000',
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    Quizzer
                </div>

                <div style={{ padding: '8px 12px' }}>
                    {selectMode ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                <Checkbox
                                    indeterminate={
                                        selectedIds.length > 0 &&
                                        selectedIds.length < tests.length
                                    }
                                    checked={selectedIds.length === tests.length}
                                    onChange={handleSelectAll}
                                >
                                </Checkbox>
                                <Button size="middle" block onClick={() => {
                                    setSelectMode(false);
                                    setSelectedIds([]);
                                }}>
                                    Cancel
                                </Button>
                                <Popconfirm
                                    title={`Delete ${selectedIds.length} test(s)?`}
                                    description="This action cannot be undone."
                                    okText="Delete"
                                    okType="danger"
                                    cancelText="Cancel"
                                    onConfirm={async () => {
                                        await Promise.all(selectedIds.map((id) => db.tests.delete(id)));
                                        message.success('Deleted selected tests');
                                        if (selectedIds.includes(selectedId || '')) {
                                            onSelect(null);
                                        }
                                        setSelectMode(false);
                                        setSelectedIds([]);
                                    }}
                                >
                                    <Button
                                        danger
                                        block
                                        disabled={selectedIds.length === 0}
                                    >
                                    Delete
                                    </Button>
                                </Popconfirm>
                            </div>
                    ) : (
                        <Button type="link" block onClick={onAdd} >
                            + New Test
                        </Button>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                    <Menu
                        mode="inline"
                        selectedKeys={selectedId ? [selectedId] : []}
                        style={{ borderRight: 0 }}
                    >
                        {tests.map((test) => {
                            const latest = test.attempts[test.attempts.length - 1];
                            const isSelected = selectedIds.includes(test.id);

                            return (
                                <Menu.Item
                                    key={test.id}
                                    onClick={() =>
                                        selectMode ? handleToggleSelection(test.id) : onSelect(test.id)
                                    }
                                    onContextMenu={(e) => handleRightClick(e, test)}
                                    style={{
                                        backgroundColor: isSelected ? '#e6f7ff' : undefined,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8,
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {selectMode && (
                                                <Checkbox
                                                    checked={isSelected}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                            )}
                                            <span
                                                style={{
                                                    maxWidth: 120,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
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
                                                        onPressEnter={(e) => e.currentTarget.blur()}
                                                        disabled={selectMode}
                                                    />
                                                ) : (
                                                    test.name
                                                )}
                                            </span>
                                        </div>
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
            </div>
        </Layout.Sider>
    );
};

export default Sidebar;

