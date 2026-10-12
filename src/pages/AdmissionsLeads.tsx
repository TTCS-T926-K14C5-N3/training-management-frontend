import { Fragment, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import "./AcademicManagement.css";
import "./TrainingCatalog.css";
import "./Admissions.css";

interface Consultant {
  nguoiDungId: number;
  hoTen: string;
  email?: string;
}

interface ProgramOption {
  chuongTrinhId: number;
  tenChuongTrinh: string;
}

interface Lead {
  leadId: number;
  hoTen: string;
  soDienThoai: string;
  email: string | null;
  nguon: string;
  trangThai: string;
  chuongTrinhId: number | null;
  tenChuongTrinh: string | null;
  ghiChu: string | null;
  nguoiPhuTrach: Consultant[];
  ngayTao: string;
  lichSuBanGiao: Array<{
    nguoiBanGiao: string;
    nguoiNhan: string;
    thoiGian: string;
  }>;
}

interface LeadsProps {
  permissions: string[];
  isTrainingManager: boolean;
}

const EMPTY_FORM = {
  hoTen: "",
  soDienThoai: "",
  email: "",
  nguon: "Website",
  chuongTrinhId: "",
  trangThai: "Mới",
  ghiChu: "",
};

const responseError = (error: unknown, fallback: string): string => {
  if (
    axios.isAxiosError<{ detail?: unknown }>(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return fallback;
};

const AdmissionsLeads: React.FC<LeadsProps> = ({
  permissions,
  isTrainingManager,
}) => {
  const canCreate = permissions.includes("LEAD_CREATE");
  const canUpdate = permissions.includes("LEAD_UPDATE");
  const canAssign = permissions.includes("LEAD_ASSIGN");
  const canDelete =
    isTrainingManager || permissions.includes("LEAD_DELETE");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkConsultantIds, setBulkConsultantIds] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    trangThai: "",
    nguon: "",
    assignedUserId: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.trangThai) params.status = filters.trangThai;
      if (filters.nguon) params.source = filters.nguon;
      if (filters.assignedUserId) {
        params.assigned_user_id = filters.assignedUserId;
      }
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      const [leadResponse, consultantResponse, programResponse] =
        await Promise.all([
          api.get<Lead[]>("/admissions/leads", { params }),
          canAssign
            ? api.get<Consultant[]>("/admissions/consultants")
            : Promise.resolve({ data: [] as Consultant[] }),
          api.get<ProgramOption[]>("/admissions/program-options"),
        ]);
      setLeads(leadResponse.data);
      setConsultants(consultantResponse.data);
      setPrograms(programResponse.data);
      setError("");
    } catch (requestError: unknown) {
      console.error("Không thể tải danh sách lead:", requestError);
      setError(responseError(requestError, "Không thể tải danh sách lead."));
    } finally {
      setLoading(false);
    }
  }, [
    canAssign,
    filters.assignedUserId,
    filters.endDate,
    filters.nguon,
    filters.search,
    filters.startDate,
    filters.trangThai,
  ]);

  useEffect(() => {
    const initialLoad = async () => {
      await loadData();
    };
    void initialLoad();
  }, [loadData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAssignedIds([]);
    setDuplicateWarning("");
  };

  const checkDuplicate = (phone: string) => {
    const normalized = phone.replace(/\D/g, "");
    const duplicate = leads.find(
      (lead) =>
        lead.leadId !== editingId &&
        lead.soDienThoai.replace(/\D/g, "") === normalized,
    );
    setDuplicateWarning(
      duplicate
        ? `Số điện thoại này đã tồn tại ở lead #${duplicate.leadId} (${duplicate.hoTen}).`
        : "",
    );
  };

  const saveLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        hoTen: form.hoTen,
        soDienThoai: form.soDienThoai,
        email: form.email || null,
        nguon: form.nguon,
        chuongTrinhId: form.chuongTrinhId
          ? Number(form.chuongTrinhId)
          : null,
        trangThai: form.trangThai,
        ghiChu: form.ghiChu || null,
      };
      let leadId = editingId;
      if (editingId) {
        await api.put(`/admissions/leads/${editingId}`, payload);
      } else {
        const response = await api.post<Lead>("/admissions/leads", payload);
        leadId = response.data.leadId;
      }
      if (leadId && canAssign) {
        await api.put(`/admissions/leads/${leadId}/assignments`, {
          consultantIds: assignedIds,
        });
      }
      resetForm();
      setNotice("Đã lưu thông tin lead.");
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể lưu lead:", requestError);
      setError(responseError(requestError, "Không thể lưu lead."));
    } finally {
      setSaving(false);
    }
  };

  const editLead = (lead: Lead) => {
    setEditingId(lead.leadId);
    setForm({
      hoTen: lead.hoTen,
      soDienThoai: lead.soDienThoai,
      email: lead.email || "",
      nguon: lead.nguon,
      chuongTrinhId: lead.chuongTrinhId
        ? String(lead.chuongTrinhId)
        : "",
      trangThai: lead.trangThai,
      ghiChu: lead.ghiChu || "",
    });
    setAssignedIds(lead.nguoiPhuTrach.map((user) => user.nguoiDungId));
    setDuplicateWarning("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteLead = async (lead: Lead) => {
    if (!window.confirm(`Xóa lead của ${lead.hoTen}?`)) return;
    setError("");
    try {
      await api.delete(`/admissions/leads/${lead.leadId}`);
      setNotice("Đã xóa lead.");
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể xóa lead:", requestError);
      setError(responseError(requestError, "Không thể xóa lead."));
    }
  };

  const toggleAssignment = (userId: number) => {
    setAssignedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l) => l.leadId));
    }
  };

  const toggleSelectLead = (id: number) => {
    setSelectedLeadIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const toggleBulkConsultant = (id: number) => {
    setBulkConsultantIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handleBulkAssign = async () => {
    if (selectedLeadIds.length === 0 || bulkConsultantIds.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/admissions/leads/bulk-assignments", {
        leadIds: selectedLeadIds,
        consultantIds: bulkConsultantIds,
      });
      setNotice(
        `Đã phân công ${selectedLeadIds.length} lead cho ${bulkConsultantIds.length} tư vấn viên.`,
      );
      setSelectedLeadIds([]);
      setBulkConsultantIds([]);
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể phân công hàng loạt:", requestError);
      setError(responseError(requestError, "Không thể phân công hàng loạt."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="academic-page">
      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">TUYỂN SINH</div>
          <h1>Khách hàng tiềm năng</h1>
          <p>Tiếp nhận, phân công và theo dõi lịch sử tư vấn tuyển sinh.</p>
        </div>
        <div className="academic-banner-stat">
          <strong>{leads.length}</strong>
          <span>Lead đang hiển thị</span>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "academic-error" : "academic-success"} role="status">
          {error || notice}
        </div>
      )}

      {(canCreate || editingId !== null) && (
        <section className="academic-card">
          <div className="academic-card-heading">
            <div>
              <h2>{editingId ? "Cập nhật lead" : "Thêm lead"}</h2>
              <p>Lead trùng số điện thoại được cảnh báo nhưng vẫn có thể lưu.</p>
            </div>
          </div>
          <form className="academic-form-grid" onSubmit={saveLead}>
            <label>
              Họ và tên *
              <input
                required
                maxLength={100}
                value={form.hoTen}
                onChange={(event) =>
                  setForm({ ...form, hoTen: event.target.value })
                }
              />
            </label>
            <label>
              Số điện thoại *
              <input
                required
                maxLength={20}
                value={form.soDienThoai}
                onChange={(event) => {
                  const phone = event.target.value;
                  setForm({ ...form, soDienThoai: phone });
                  checkDuplicate(phone);
                }}
              />
              {duplicateWarning && (
                <small className="admissions-duplicate-warning" role="status">
                  {duplicateWarning}
                </small>
              )}
            </label>
            <label>
              Email
              <input
                type="email"
                maxLength={255}
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label>
              Nguồn
              <input
                required
                maxLength={100}
                value={form.nguon}
                onChange={(event) =>
                  setForm({ ...form, nguon: event.target.value })
                }
              />
            </label>
            <label>
              Chương trình quan tâm
              <select
                value={form.chuongTrinhId}
                onChange={(event) =>
                  setForm({ ...form, chuongTrinhId: event.target.value })
                }
              >
                <option value="">Chưa xác định</option>
                {programs.map((program) => (
                  <option
                    key={program.chuongTrinhId}
                    value={program.chuongTrinhId}
                  >
                    {program.tenChuongTrinh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={form.trangThai}
                onChange={(event) =>
                  setForm({ ...form, trangThai: event.target.value })
                }
              >
                <option value="Mới">Mới</option>
                <option value="Đang tư vấn">Đang tư vấn</option>
                <option value="Tiềm năng">Tiềm năng</option>
                <option value="Không tiềm năng">Không tiềm năng</option>
                <option value="Đã đăng ký">Đã đăng ký</option>
              </select>
            </label>
            <label className="academic-wide-field">
              Ghi chú
              <textarea
                maxLength={2000}
                value={form.ghiChu}
                onChange={(event) =>
                  setForm({ ...form, ghiChu: event.target.value })
                }
              />
            </label>
            {canAssign && (
              <fieldset className="lead-assignments academic-wide-field">
                <legend>Phân công tư vấn viên</legend>
                {consultants.map((consultant) => (
                  <label key={consultant.nguoiDungId}>
                    <input
                      type="checkbox"
                      checked={assignedIds.includes(consultant.nguoiDungId)}
                      onChange={() => toggleAssignment(consultant.nguoiDungId)}
                    />
                    {consultant.hoTen}
                  </label>
                ))}
                {consultants.length === 0 && (
                  <span className="academic-muted">Không có tư vấn viên khả dụng.</span>
                )}
              </fieldset>
            )}
            <div className="academic-form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm lead"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm}>
                  Hủy
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh sách lead</h2>
            <p>Tìm kiếm theo tên/số điện thoại và lọc theo điều kiện.</p>
          </div>
        </div>
        <div className="academic-filters lead-filters">
          <label>
            Tìm kiếm
            <input
              placeholder="Tên hoặc số điện thoại"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </label>
          <label>
            Trạng thái
            <select
              value={filters.trangThai}
              onChange={(event) =>
                setFilters({ ...filters, trangThai: event.target.value })
              }
            >
              <option value="">Tất cả</option>
              <option value="Mới">Mới</option>
              <option value="Đang tư vấn">Đang tư vấn</option>
              <option value="Tiềm năng">Tiềm năng</option>
              <option value="Không tiềm năng">Không tiềm năng</option>
              <option value="Đã đăng ký">Đã đăng ký</option>
            </select>
          </label>
          <label>
            Nguồn
            <input
              value={filters.nguon}
              onChange={(event) =>
                setFilters({ ...filters, nguon: event.target.value })
              }
            />
          </label>
          {canAssign && (
            <label>
              Người phụ trách
              <select
                value={filters.assignedUserId}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    assignedUserId: event.target.value,
                  })
                }
              >
                <option value="">Tất cả</option>
                {consultants.map((consultant) => (
                  <option
                    key={consultant.nguoiDungId}
                    value={consultant.nguoiDungId}
                  >
                    {consultant.hoTen}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters({ ...filters, startDate: event.target.value })
              }
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters({ ...filters, endDate: event.target.value })
              }
            />
          </label>
        </div>
        {canAssign && selectedLeadIds.length > 0 && (
          <div className="lead-bulk-toolbar" role="region" aria-label="Phân công hàng loạt">
            <div className="lead-bulk-info">
              <strong>Đã chọn {selectedLeadIds.length} lead</strong>
              <button
                type="button"
                onClick={() => setSelectedLeadIds([])}
              >
                Bỏ chọn tất cả
              </button>
            </div>
            <div className="lead-bulk-assign">
              <span>Phân công cho tư vấn viên:</span>
              <div className="lead-bulk-consultant-pills">
                {consultants.map((c) => {
                  const isChecked = bulkConsultantIds.includes(c.nguoiDungId);
                  return (
                    <label
                      key={c.nguoiDungId}
                      className={`lead-consultant-pill ${isChecked ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBulkConsultant(c.nguoiDungId)}
                      />
                      {c.hoTen}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="lead-bulk-apply-btn"
                disabled={saving || bulkConsultantIds.length === 0}
                onClick={() => void handleBulkAssign()}
              >
                {saving
                  ? "Đang lưu..."
                  : `Áp dụng phân công (${selectedLeadIds.length} lead)`}
              </button>
            </div>
          </div>
        )}
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                {canAssign && (
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={
                        leads.length > 0 &&
                        selectedLeadIds.length === leads.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Chọn tất cả lead"
                    />
                  </th>
                )}
                <th>Khách hàng</th>
                <th>Chương trình</th>
                <th>Nguồn / trạng thái</th>
                <th>Người phụ trách</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                leads.map((lead) => (
                  <Fragment key={lead.leadId}>
                    <tr>
                      {canAssign && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.leadId)}
                            onChange={() => toggleSelectLead(lead.leadId)}
                            aria-label={`Chọn lead ${lead.hoTen}`}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{lead.hoTen}</strong>
                        <small className="academic-muted">{lead.soDienThoai}</small>
                        {lead.email && (
                          <small className="academic-muted">{lead.email}</small>
                        )}
                      </td>
                      <td>{lead.tenChuongTrinh || "Chưa xác định"}</td>
                      <td>
                        {lead.nguon}
                        <small className="academic-muted">{lead.trangThai}</small>
                      </td>
                      <td>
                        {lead.nguoiPhuTrach.length > 0
                          ? lead.nguoiPhuTrach.map((person) => person.hoTen).join(", ")
                          : "Chưa phân công"}
                      </td>
                      <td>{new Date(lead.ngayTao).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <div className="lead-row-actions">
                          {canUpdate && (
                            <button type="button" onClick={() => editLead(lead)}>
                              Sửa
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(
                                expandedId === lead.leadId ? null : lead.leadId,
                              )
                            }
                          >
                            Lịch sử
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void deleteLead(lead)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === lead.leadId && (
                      <tr>
                        <td colSpan={canAssign ? 7 : 6}>
                          <strong>Lịch sử bàn giao</strong>
                          {lead.lichSuBanGiao.length > 0 ? (
                            <ul className="lead-history">
                              {lead.lichSuBanGiao.map((entry, index) => (
                                <li key={`${lead.leadId}-${index}`}>
                                  {entry.nguoiBanGiao} bàn giao cho {entry.nguoiNhan}
                                  {" — "}
                                  {new Date(entry.thoiGian).toLocaleString("vi-VN")}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="academic-muted">Chưa có lịch sử bàn giao.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={canAssign ? 7 : 6}>Không có lead phù hợp.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={canAssign ? 7 : 6}>Đang tải danh sách...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdmissionsLeads;
