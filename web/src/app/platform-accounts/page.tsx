"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type Streamer = { id: number; name: string; direction: string };
type PlatformAccount = {
  id: number;
  platform: string;
  display_name: string;
  account_handle: string;
  account_type: string;
  connection_status: string;
  authorization_status: string;
  follower_range: string;
  notes: string;
  last_synced_at: string;
  anchor: null | { id: number; name: string };
  is_primary: boolean;
  member_role: string;
  member_count: number;
  capability_status: Record<string, boolean>;
  members?: PlatformMember[];
  sync_jobs?: SyncJob[];
  data_snapshots?: DataSnapshot[];
};

type PlatformMember = {
  id: number;
  user_name: string;
  phone_masked: string;
  role: string;
  permission_scope: string;
  status: string;
};

type SyncJob = {
  id: number;
  sync_type: string;
  status: string;
  completed_at: string;
  records_synced: number;
  error_message: string;
  created_at: string;
};

type DataSnapshot = {
  id: number;
  data_type: string;
  snapshot_date: string;
  source: string;
  created_at: string;
};

const accountTypes = ["个人账号", "企业账号", "达人账号", "商家账号", "机构账号", "其他"];
const followerRanges = ["", "1千以下", "1千-1万", "1万-10万", "10万-100万", "100万以上"];
const memberRoles = [
  { value: "admin", label: "管理员" },
  { value: "operator", label: "运营" },
  { value: "viewer", label: "只读查看" }
];
const capabilityLabels = ["基础资料可读取", "粉丝数据可读取", "作品数据可读取", "广告投放数据可读取", "直播数据可读取", "电商直播数据可读取", "暂不支持"];

export default function PlatformAccountsPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<PlatformAccount | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [anchorId, setAnchorId] = useState("");
  const [accountType, setAccountType] = useState("个人账号");
  const [followerRange, setFollowerRange] = useState("");
  const [notes, setNotes] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberRole, setMemberRole] = useState("operator");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAccountHandle, setEditAccountHandle] = useState("");
  const [editAnchorId, setEditAnchorId] = useState("");
  const [editAccountType, setEditAccountType] = useState("个人账号");
  const [editFollowerRange, setEditFollowerRange] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  function fillEditForm(account: PlatformAccount) {
    setEditDisplayName(account.display_name);
    setEditAccountHandle(account.account_handle || "");
    setEditAnchorId(account.anchor?.id ? String(account.anchor.id) : "");
    setEditAccountType(account.account_type || "个人账号");
    setEditFollowerRange(account.follower_range || "");
    setEditNotes(account.notes || "");
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [streamerResult, accountResult] = await Promise.all([
        apiFetch<Streamer[]>("/api/streamers"),
        apiFetch<{ items: PlatformAccount[] }>("/api/platform-accounts")
      ]);
      setStreamers(streamerResult);
      setAccounts(accountResult.items);
      if (streamerResult[0] && !anchorId) setAnchorId(String(streamerResult[0].id));
      if (selectedAccount) {
        const stillExists = accountResult.items.some((account) => account.id === selectedAccount.id);
        if (stillExists) await openDetail(selectedAccount.id, false);
        else setSelectedAccount(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function saveManualAccount() {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/platform-accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: "douyin",
          display_name: displayName,
          account_handle: accountHandle,
          anchor_id: anchorId ? Number(anchorId) : null,
          account_type: accountType,
          follower_range: followerRange,
          notes
        })
      });
      setDisplayName("");
      setAccountHandle("");
      setNotes("");
      setMessage("抖音账号已手动记录。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function connectDouyin() {
    setError("");
    setMessage("");
    const result = await apiFetch<{ configured: boolean; message: string; authorization_url: string }>("/api/platform/oauth/douyin/authorize-url", {
      method: "POST"
    });
    if (!result.configured) {
      setMessage(result.message);
      return;
    }
    window.location.href = result.authorization_url;
  }

  async function archiveAccount(account: PlatformAccount) {
    if (!window.confirm(`确定归档“${account.display_name}”？已有复盘不会删除。`)) return;
    await apiFetch(`/api/platform-accounts/${account.id}/archive`, { method: "POST" });
    setMessage("平台账号已归档。");
    setSelectedAccount(null);
    await load();
  }

  async function setPrimary(account: PlatformAccount) {
    if (!account.anchor?.id) {
      setError("请先绑定主播，再设为主要账号。");
      return;
    }
    await apiFetch(`/api/platform-accounts/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ anchor_id: account.anchor.id, is_primary: true })
    });
    setMessage("已设为该主播的主要账号。");
    await load();
  }

  async function openDetail(accountId: number, clearNotice = true) {
    if (clearNotice) {
      setError("");
      setMessage("");
    }
    try {
      const result = await apiFetch<PlatformAccount>(`/api/platform-accounts/${accountId}`);
      setSelectedAccount(result);
      fillEditForm(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取账号详情失败");
    }
  }

  async function saveAccountEdits() {
    if (!selectedAccount) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const detail = await apiFetch<PlatformAccount>(`/api/platform-accounts/${selectedAccount.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: editDisplayName,
          account_handle: editAccountHandle,
          account_type: editAccountType,
          follower_range: editFollowerRange,
          notes: editNotes,
          anchor_id: editAnchorId ? Number(editAnchorId) : null,
          is_primary: Boolean(editAnchorId && selectedAccount.is_primary)
        })
      });
      setSelectedAccount(detail);
      fillEditForm(detail);
      setMessage(editAnchorId ? "平台账号信息已保存。" : "平台账号信息已保存，并已解除主播绑定。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存账号信息失败");
    } finally {
      setWorking(false);
    }
  }

  async function addMember() {
    if (!selectedAccount) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const detail = await apiFetch<PlatformAccount>(`/api/platform-accounts/${selectedAccount.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          phone: memberPhone,
          role: memberRole,
          permission_scope: memberRole === "viewer" ? "read" : "review,report,rule"
        })
      });
      setSelectedAccount(detail);
      setMemberPhone("");
      setMessage("成员权限已保存。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加成员失败");
    } finally {
      setWorking(false);
    }
  }

  async function updateMember(member: PlatformMember, role: string) {
    if (!selectedAccount) return;
    setWorking(true);
    setError("");
    try {
      const detail = await apiFetch<PlatformAccount>(`/api/platform-accounts/${selectedAccount.id}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          permission_scope: role === "viewer" ? "read" : "review,report,rule"
        })
      });
      setSelectedAccount(detail);
      setMessage("成员角色已更新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新成员失败");
    } finally {
      setWorking(false);
    }
  }

  async function removeMember(member: PlatformMember) {
    if (!selectedAccount) return;
    if (!window.confirm(`确定移除“${member.user_name || member.phone_masked}”？`)) return;
    setWorking(true);
    setError("");
    try {
      const detail = await apiFetch<PlatformAccount>(`/api/platform-accounts/${selectedAccount.id}/members/${member.id}`, { method: "DELETE" });
      setSelectedAccount(detail);
      setMessage("成员已移除。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除成员失败");
    } finally {
      setWorking(false);
    }
  }

  async function requestSync(syncType = "account_profile") {
    if (!selectedAccount) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const job = await apiFetch<SyncJob>(`/api/platform-accounts/${selectedAccount.id}/sync?sync_type=${syncType}`, { method: "POST" });
      setMessage(job.error_message || "同步任务已创建。");
      await openDetail(selectedAccount.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="平台账号" desc="记录或连接实际使用的抖音直播账号。手动记录不会显示为官方已连接。" />
      {loading ? <StatusMessage type="loading" text="正在读取平台账号..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-bold">手动记录抖音账号</h2>
          <div className="grid gap-3">
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="抖音昵称" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="抖音号，可不填" value={accountHandle} onChange={(event) => setAccountHandle(event.target.value)} />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={anchorId} onChange={(event) => setAnchorId(event.target.value)}>
              <option value="">暂不绑定主播</option>
              {streamers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction}</option>)}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {accountTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={followerRange} onChange={(event) => setFollowerRange(event.target.value)}>
              {followerRanges.map((item) => <option key={item} value={item}>{item || "粉丝区间，可不填"}</option>)}
            </select>
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="备注，例如团队分工、账号用途" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <PrimaryButton disabled={!displayName || working} onClick={saveManualAccount}>{working ? "正在保存..." : "保存账号"}</PrimaryButton>
          </div>
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            当前可以先手动记录账号。官方连接暂未开放，不影响上传截图、补充数据和生成复盘报告。
          </div>
          <SecondaryButton className="mt-3" onClick={connectDouyin}>连接抖音账号</SecondaryButton>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-4 text-lg font-bold">已连接账号</h2>
            {!accounts.length ? <StatusMessage type="empty" text="还没有平台账号。先手动记录一个抖音账号。" /> : null}
            <div className="space-y-3">
              {accounts.map((account) => (
                <button key={account.id} className="w-full rounded-md border border-slate-200 p-4 text-left hover:bg-slate-50" onClick={() => openDetail(account.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{account.display_name}{account.is_primary ? " · 主要账号" : ""}</div>
                      <div className="mt-1 text-sm text-slate-500">抖音号：{account.account_handle || "未填写"} · {account.account_type}</div>
                      <div className="mt-1 text-sm text-slate-500">所属主播：{account.anchor?.name || "未绑定主播"}</div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{account.connection_status}</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">权限：{account.member_role || "未知"} · 最近同步：{account.last_synced_at || "暂无"}</div>
                </button>
              ))}
            </div>
          </Card>

          {selectedAccount ? (
            <Card>
              <h2 className="mb-3 text-lg font-bold">账号详情</h2>
              <div className="space-y-2 text-sm text-slate-600">
                <div>抖音昵称：{selectedAccount.display_name}</div>
                <div>抖音号：{selectedAccount.account_handle || "未填写"}</div>
                <div>绑定主播：{selectedAccount.anchor?.name || "未绑定"}</div>
                <div>授权状态：{selectedAccount.authorization_status}</div>
                <div>成员数量：{selectedAccount.member_count}</div>
                <div>说明：{selectedAccount.notes || "无"}</div>
              </div>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                {selectedAccount.capability_status["暂不支持"] ? "已手动记录，当前未获得官方直播数据权限。" : "已连接，可同步基础账号数据。"}
              </div>
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-bold">官方能力状态</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {capabilityLabels.map((item) => (
                    <div key={item} className={`rounded-md px-3 py-2 text-xs ${selectedAccount.capability_status[item] ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}`}>
                      {item}：{selectedAccount.capability_status[item] ? "可用" : "不可用"}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <SecondaryButton onClick={() => setPrimary(selectedAccount)}>设为主要账号</SecondaryButton>
                <SecondaryButton onClick={connectDouyin}>重新授权</SecondaryButton>
                <SecondaryButton disabled={working} onClick={() => requestSync()}>查看同步状态</SecondaryButton>
                <SecondaryButton onClick={() => archiveAccount(selectedAccount)}>归档</SecondaryButton>
              </div>
              {(selectedAccount.member_role === "owner" || selectedAccount.member_role === "admin") ? (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <h3 className="mb-2 text-sm font-bold">编辑账号信息</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="抖音昵称" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} />
                    <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="抖音号，可不填" value={editAccountHandle} onChange={(event) => setEditAccountHandle(event.target.value)} />
                    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={editAnchorId} onChange={(event) => setEditAnchorId(event.target.value)}>
                      <option value="">不绑定主播</option>
                      {streamers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction}</option>)}
                    </select>
                    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={editAccountType} onChange={(event) => setEditAccountType(event.target.value)}>
                      {accountTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={editFollowerRange} onChange={(event) => setEditFollowerRange(event.target.value)}>
                      {followerRanges.map((item) => <option key={item} value={item}>{item || "粉丝区间，可不填"}</option>)}
                    </select>
                    <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" placeholder="备注" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                  </div>
                  <PrimaryButton className="mt-3" disabled={!editDisplayName || working} onClick={saveAccountEdits}>
                    {working ? "正在保存..." : "保存账号信息"}
                  </PrimaryButton>
                </div>
              ) : null}
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-sm font-bold">账号成员</h3>
                <div className="space-y-2">
                  {(selectedAccount.members || []).map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                      <span>{member.user_name || "成员"} · {member.phone_masked}</span>
                      <span className="text-xs text-slate-500">{member.role} · {member.status}</span>
                      {selectedAccount.member_role === "owner" || selectedAccount.member_role === "admin" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={member.role} disabled={working} onChange={(event) => updateMember(member, event.target.value)}>
                            <option value="owner">负责人</option>
                            {memberRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-50" disabled={working} onClick={() => removeMember(member)}>移除</button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {selectedAccount.member_role === "owner" || selectedAccount.member_role === "admin" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                    <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="成员注册手机号" value={memberPhone} onChange={(event) => setMemberPhone(event.target.value)} />
                    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                      {memberRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <PrimaryButton disabled={!memberPhone || working} onClick={addMember}>添加成员</PrimaryButton>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-500">当前权限只能查看成员，不能邀请或修改成员。</div>
                )}
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-sm font-bold">同步记录</h3>
                {!(selectedAccount.sync_jobs || []).length ? <StatusMessage type="empty" text="还没有同步记录。当前官方连接暂未开放，账号数据需要先手动维护。" /> : null}
                <div className="space-y-2">
                  {(selectedAccount.sync_jobs || []).map((job) => (
                    <div key={job.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <div className="font-medium">{job.sync_type} · {job.status}</div>
                      <div className="mt-1 text-xs text-slate-500">{job.completed_at || job.created_at} · {job.error_message || `同步 ${job.records_synced} 条`}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-sm font-bold">数据快照</h3>
                {!(selectedAccount.data_snapshots || []).length ? <StatusMessage type="empty" text="暂无官方数据快照。直播复盘和手动录入不受影响。" /> : null}
                <div className="space-y-2">
                  {(selectedAccount.data_snapshots || []).map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                      {item.data_type} · {item.source} · {item.snapshot_date || "未标注日期"}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
