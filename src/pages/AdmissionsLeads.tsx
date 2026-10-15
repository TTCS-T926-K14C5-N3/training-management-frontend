import { Fragment, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
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
  hocVienId: number | null;
  maHocVien: string | null;
  chuongTrinhId: number | null;
  tenChuongTrinh: string | null;
  ghiChu: string | null;
  lyDoTuChoi: string | null;
  henGoiLaiQuaHan: boolean;
  nguoiPhuTrach: Consultant[];
  ngayTao: string;
  lichSuBanGiao: Array<{
    nguoiBanGiao: string | null;
    nguoiNhan: string | null;
    thoiGian: string;
    ngayBoPhanCong: string | null;
  }>;
  lichSuTrangThai: Array<{
    trangThaiCu: string | null;
    trangThaiMoi: string;
    lyDo: string | null;
    nguoiThucHien: string | null;
    thoiDiem: string;
  }>;
  tuongTacs: Array<{
    tuongTacId: number;
    loai: string;
    noiDung: string;
    thoiDiem: string;
    henGoiLaiLuc: string | null;
    henGoiLaiQuaHan: boolean;
    nguoiThucHien: string | null;
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
  lyDoTuChoi: "",
};

const LOCAL_DATE_TIME = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const LEAD_STATUS_COLUMNS = [
  "Mới",
  "Đã liên hệ",
  "Đang tư vấn",
  "Hẹn học thử",
  "Chốt",
  "Từ chối",
] as const;

const LEAD_STATUS_PROGRESS = LEAD_STATUS_COLUMNS.slice(0, 5);

const LEAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  "Mới": [...LEAD_STATUS_PROGRESS.slice(1), "Từ chối"],
  "Đã liên hệ": [...LEAD_STATUS_PROGRESS.slice(2), "Từ chối"],
  "Đang tư vấn": [...LEAD_STATUS_PROGRESS.slice(3), "Từ chối"],
  "Hẹn học thử": ["Chốt", "Từ chối"],
  "Đang liên hệ": ["Đang tư vấn", "Hẹn học thử", "Chốt", "Từ chối"],
  "Tiềm năng": ["Hẹn học thử", "Chốt", "Từ chối"],
};

const responseError = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError<{ detail?: unknown }>(error)) {
    return fallback;
  }

  const response = error.response;
  const detail = response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const fieldNames: Record<string, string> = {
      chuongTrinhId: "Chương trình quan tâm",
      email: "Email",
      ghiChu: "Ghi chú",
      hoTen: "Họ và tên",
      nguon: "Nguồn",
      soDienThoai: "Số điện thoại",
      trangThai: "Trạng thái",
    };
    const validationMessages = detail.flatMap((issue: unknown) => {
      if (
        typeof issue !== "object" ||
        issue === null ||
        !("msg" in issue) ||
        typeof issue.msg !== "string"
      ) {
        return [];
      }
      const location =
        "loc" in issue && Array.isArray(issue.loc)
          ? issue.loc[issue.loc.length - 1]
          : null;
      const field =
        typeof location === "string"
          ? `${fieldNames[location] ?? location}: `
          : "";
      return [`${field}${issue.msg}`];
    });
    if (validationMessages.length > 0) {
      return `Thông tin chưa hợp lệ: ${validationMessages.join("; ")}`;
    }
  }

  if (!response) {
    const requestUrl = [
      error.config?.baseURL?.replace(/\/+$/, ""),
      error.config?.url?.replace(/^\/+/, ""),
    ]
      .filter(Boolean)
      .join("/");
    const endpoint = requestUrl ? ` (${requestUrl})` : "";
    return `Không nhận được phản hồi từ API${endpoint}: ${
      error.message || "lỗi kết nối mạng"
    }.`;
  }
  if (response.status === 401) {
    return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (response.status === 403) {
    return "Tài khoản không có quyền thực hiện thao tác này.";
  }
  if (response.status >= 500) {
    return `Máy chủ gặp lỗi khi xử lý yêu cầu (HTTP ${response.status}). Vui lòng kiểm tra log backend.`;
  }
  return `Yêu cầu thất bại (HTTP ${response.status}). ${fallback}`;
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
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assignedId, setAssignedId] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkConsultantId, setBulkConsultantId] = useState("");
  const [historyLeadId, setHistoryLeadId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
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
  const [interactionForm, setInteractionForm] = useState({
    loai: "Gọi",
    noiDung: "",
    thoiDiem: LOCAL_DATE_TIME(),
    henGoiLaiLuc: "",
  });
  const [statusForm, setStatusForm] = useState({
    trangThai: "",
    lyDoTuChoi: "",
  });
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [rejectionLead, setRejectionLead] = useState<Lead | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleSearchSubmit = () => {
    const term = searchInput.trim();
    if (term === filters.search) {
      void loadData();
    } else {
      setFilters((current) => ({ ...current, search: term }));
    }
  };

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
      const [leadResult, consultantResult, programResult] =
        await Promise.allSettled([
          api.get<Lead[]>("/admissions/leads", { params }),
          canAssign
            ? api.get<Consultant[]>("/admissions/consultants")
            : Promise.resolve({ data: [] as Consultant[] }),
          api.get<ProgramOption[]>("/admissions/program-options"),
        ]);
      if (leadResult.status === "rejected") {
        throw leadResult.reason;
      }
      setLeads(leadResult.value.data);
      const visibleLeadIds = new Set(
        leadResult.value.data.map((lead) => lead.leadId),
      );
      setSelectedLeadIds((selected) =>
        selected.filter((leadId) => visibleLeadIds.has(leadId)),
      );

      const auxiliaryErrors: string[] = [];
      if (consultantResult.status === "fulfilled") {
        setConsultants(consultantResult.value.data);
      } else {
        console.error("Không thể tải danh sách tư vấn viên:", consultantResult.reason);
        setConsultants([]);
        auxiliaryErrors.push(
          responseError(
            consultantResult.reason,
            "Không thể tải danh sách tư vấn viên.",
          ),
        );
      }
      if (programResult.status === "fulfilled") {
        setPrograms(programResult.value.data);
      } else {
        console.error("Không thể tải danh sách chương trình:", programResult.reason);
        setPrograms([]);
        auxiliaryErrors.push(
          responseError(
            programResult.reason,
            "Không thể tải danh sách chương trình.",
          ),
        );
      }
      setError(auxiliaryErrors.join(" "));
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
    setAssignedId("");
    setDuplicateWarning("");
    setIsLeadFormOpen(false);
  };

  const openCreateLead = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAssignedId("");
    setDuplicateWarning("");
    setError("");
    setIsLeadFormOpen(true);
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
    let savedLeadId: number | null = null;
    let leadSaved = false;
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
        lyDoTuChoi: form.lyDoTuChoi || null,
      };
      let leadId = editingId;
      if (editingId) {
        await api.put(`/admissions/leads/${editingId}`, payload);
        leadSaved = true;
      } else {
        const response = await api.post<Lead>("/admissions/leads", payload);
        leadId = response.data.leadId;
        savedLeadId = leadId;
        leadSaved = true;
        setEditingId(leadId);
      }
      if (leadId && canAssign) {
        await api.put(`/admissions/leads/${leadId}/assignments`, {
          consultantIds: assignedId ? [Number(assignedId)] : [],
        });
      }
      resetForm();
      setNotice("Đã lưu thông tin lead.");
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể lưu lead:", requestError);
      const detail = responseError(requestError, "Không thể lưu lead.");
      setError(
        leadSaved
          ? savedLeadId !== null
            ? `Lead #${savedLeadId} đã được tạo nhưng phân công chưa hoàn tất. Bấm lưu lại để thử phân công lần nữa. ${detail}`
            : `Thông tin lead đã lưu nhưng phân công chưa hoàn tất. Bấm lưu lại để thử lại. ${detail}`
          : detail,
      );
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
      lyDoTuChoi: lead.lyDoTuChoi || "",
    });
    setAssignedId(
      lead.nguoiPhuTrach[0]
        ? String(lead.nguoiPhuTrach[0].nguoiDungId)
        : "",
    );
    setDuplicateWarning("");
    setError("");
    setIsLeadFormOpen(true);
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

  const convertLead = async (lead: Lead) => {
    if (!lead.email) {
      setError("Cần bổ sung email cho lead trước khi tạo tài khoản học viên.");
      return;
    }
    if (
      !window.confirm(
        `Chuyển ${lead.hoTen} thành học viên và gửi email kích hoạt đến ${lead.email}?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post<{
        alreadyConverted: boolean;
        maHocVien: string;
        message: string;
      }>(`/admissions/leads/${lead.leadId}/convert-to-student`);
      setNotice(response.data.message);
      setSelectedLeadIds((current) =>
        current.filter((leadId) => leadId !== lead.leadId),
      );
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể chuyển lead thành học viên:", requestError);
      setError(
        responseError(
          requestError,
          "Không thể chuyển lead thành hồ sơ học viên.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const saveInteraction = async (
    event: FormEvent<HTMLFormElement>,
    lead: Lead,
  ) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post(`/admissions/leads/${lead.leadId}/interactions`, {
        loai: interactionForm.loai,
        noiDung: interactionForm.noiDung,
        thoiDiem: new Date(interactionForm.thoiDiem).toISOString(),
        henGoiLaiLuc: interactionForm.henGoiLaiLuc
          ? new Date(interactionForm.henGoiLaiLuc).toISOString()
          : null,
      });
      setInteractionForm({
        loai: "Gọi",
        noiDung: "",
        thoiDiem: LOCAL_DATE_TIME(),
        henGoiLaiLuc: "",
      });
      setHistoryLeadId(null);
      setNotice("Đã ghi nhật ký tương tác.");
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể ghi nhật ký tương tác:", requestError);
      setError(responseError(requestError, "Không thể ghi nhật ký tương tác."));
    } finally {
      setSaving(false);
    }
  };

  const openLeadHistory = (lead: Lead) => {
    setHistoryLeadId(lead.leadId);
    setViewMode("table");
    setStatusForm({
      trangThai: LEAD_STATUS_TRANSITIONS[lead.trangThai]?.[0] ?? "",
      lyDoTuChoi: "",
    });
    setInteractionForm({
      loai: "Gọi",
      noiDung: "",
      thoiDiem: LOCAL_DATE_TIME(),
      henGoiLaiLuc: "",
    });
    setError("");
  };

  const saveLeadStatus = async (
    event: FormEvent<HTMLFormElement>,
    lead: Lead,
  ) => {
    event.preventDefault();
    if (!statusForm.trangThai) return;
    await updateLeadStatus(
      lead,
      statusForm.trangThai,
      statusForm.trangThai === "Từ chối" ? statusForm.lyDoTuChoi : null,
    );
  };

  const updateLeadStatus = async (
    lead: Lead,
    targetStatus: string,
    reason: string | null,
  ): Promise<boolean> => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/admissions/leads/${lead.leadId}/status`, {
        trangThai: targetStatus,
        lyDoTuChoi: reason,
      });
      setHistoryLeadId(null);
      setNotice(
        `Đã cập nhật trạng thái mới cho học viên ${lead.hoTen}: ${targetStatus}.`,
      );
      await loadData();
      return true;
    } catch (requestError: unknown) {
      console.error("Không thể cập nhật trạng thái lead:", requestError);
      setError(
        responseError(requestError, "Không thể cập nhật trạng thái lead."),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const canDropLeadIntoStatus = (lead: Lead, targetStatus: string) =>
    canUpdate &&
    targetStatus !== "Khác" &&
    (LEAD_STATUS_TRANSITIONS[lead.trangThai] ?? []).includes(targetStatus);

  const handleLeadDrop = async (lead: Lead, targetStatus: string) => {
    if (!canDropLeadIntoStatus(lead, targetStatus)) return;
    if (targetStatus === "Từ chối") {
      setRejectionLead(lead);
      setRejectionReason(lead.lyDoTuChoi ?? "");
      setError("");
      return;
    }
    await updateLeadStatus(lead, targetStatus, null);
  };

  const submitRejection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectionLead) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Vui lòng nhập lý do từ chối trước khi cập nhật trạng thái.");
      return;
    }
    if (await updateLeadStatus(rejectionLead, "Từ chối", reason)) {
      setRejectionLead(null);
      setRejectionReason("");
    }
  };

  const toggleSelectAll = () => {
    const selectableLeadIds = leads
      .filter((lead) => !["Đã nhập học", "Từ chối"].includes(lead.trangThai))
      .map((lead) => lead.leadId);
    if (selectedLeadIds.length === selectableLeadIds.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(selectableLeadIds);
    }
  };

  const toggleSelectLead = (id: number) => {
    setSelectedLeadIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handleBulkAssign = async () => {
    if (selectedLeadIds.length === 0 || bulkConsultantId === "") return;
    const consultantIds =
      bulkConsultantId === "unassigned" ? [] : [Number(bulkConsultantId)];
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/admissions/leads/bulk-assignments", {
        leadIds: selectedLeadIds,
        consultantIds,
      });
      setNotice(
        consultantIds.length === 0
          ? `Đã gỡ phân công ${selectedLeadIds.length} lead.`
          : `Đã giao ${selectedLeadIds.length} lead cho ${
              consultants.find(
                (consultant) =>
                  consultant.nguoiDungId === consultantIds[0],
              )?.hoTen ?? "tư vấn viên"
            }.`,
      );
      setSelectedLeadIds([]);
      setBulkConsultantId("");
      await loadData();
    } catch (requestError: unknown) {
      console.error("Không thể phân công hàng loạt:", requestError);
      setError(responseError(requestError, "Không thể phân công hàng loạt."));
    } finally {
      setSaving(false);
    }
  };

  const historyLead = leads.find((lead) => lead.leadId === historyLeadId) ?? null;
  const availableStatusTransitions = historyLead
    ? LEAD_STATUS_TRANSITIONS[historyLead.trangThai] ?? []
    : [];

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
        <ToastNotification
          type={error ? "error" : "success"}
          text={error || notice}
          durationMs={3000}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      )}

      {isLeadFormOpen && (
        <div
          className="lead-form-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) resetForm();
          }}
        >
        <section
          className="lead-form-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-form-modal-title"
        >
          <header className="lead-form-modal-header">
            <div>
              <h2 id="lead-form-modal-title">
                {editingId ? "Cập nhật lead" : "Thêm lead"}
              </h2>
              <p>Lead trùng số điện thoại được cảnh báo nhưng vẫn có thể lưu.</p>
            </div>
            <button
              type="button"
              aria-label="Đóng biểu mẫu lead"
              disabled={saving}
              onClick={resetForm}
            >
              ×
            </button>
          </header>
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
                disabled={!editingId}
                value={form.trangThai}
                onChange={(event) =>
                  setForm({ ...form, trangThai: event.target.value })
                }
              >
                <option value="Mới">Mới</option>
                <option value="Đã liên hệ">Đã liên hệ</option>
                <option value="Đang tư vấn">Đang tư vấn</option>
                <option value="Hẹn học thử">Hẹn học thử</option>
                <option value="Chốt">Chốt</option>
                <option value="Từ chối">Từ chối</option>
                {editingId &&
                  ![
                    "Mới",
                    "Đã liên hệ",
                    "Đang tư vấn",
                    "Hẹn học thử",
                    "Chốt",
                    "Từ chối",
                  ].includes(form.trangThai) && (
                    <option value={form.trangThai}>{form.trangThai}</option>
                  )}
              </select>
            </label>
            {form.trangThai === "Từ chối" && (
              <label>
                Lý do từ chối *
                <input
                  required
                  list="lead-decline-reasons"
                  maxLength={500}
                  value={form.lyDoTuChoi}
                  onChange={(event) =>
                    setForm({ ...form, lyDoTuChoi: event.target.value })
                  }
                  placeholder="Chọn hoặc nhập lý do"
                />
                <datalist id="lead-decline-reasons">
                  <option value="Không còn nhu cầu" />
                  <option value="Không phù hợp chương trình" />
                  <option value="Không liên hệ được" />
                  <option value="Chọn đơn vị đào tạo khác" />
                  <option value="Không phù hợp ngân sách" />
                </datalist>
              </label>
            )}
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
                <label>
                  Người phụ trách
                  <select
                    value={assignedId}
                    onChange={(event) => setAssignedId(event.target.value)}
                  >
                    <option value="">Chưa phân công</option>
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
              </fieldset>
            )}
            <div className="academic-form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm lead"}
              </button>
              <button type="button" disabled={saving} onClick={resetForm}>
                Hủy
              </button>
            </div>
          </form>
        </section>
        </div>
      )}

      {rejectionLead && (
        <div
          className="lead-rejection-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setRejectionLead(null);
              setRejectionReason("");
            }
          }}
        >
          <section
            className="lead-rejection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-rejection-title"
          >
            <header className="lead-form-modal-header">
              <div>
                <h2 id="lead-rejection-title">Từ chối lead</h2>
                <p>
                  Lead <strong>{rejectionLead.hoTen}</strong> sẽ được chuyển
                  sang trạng thái Từ chối.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng popup từ chối lead"
                disabled={saving}
                onClick={() => {
                  setRejectionLead(null);
                  setRejectionReason("");
                }}
              >
                ×
              </button>
            </header>
            <form className="lead-rejection-form" onSubmit={submitRejection}>
              <label htmlFor="lead-rejection-reason">Lý do từ chối *</label>
              <textarea
                id="lead-rejection-reason"
                autoFocus
                required
                maxLength={500}
                rows={4}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Nhập lý do để lưu vào lịch sử lead"
              />
              <small>{rejectionReason.length}/500 ký tự</small>
              <div className="lead-rejection-actions">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setRejectionLead(null);
                    setRejectionReason("");
                  }}
                >
                  Hủy
                </button>
                <button type="submit" disabled={saving || !rejectionReason.trim()}>
                  {saving ? "Đang lưu..." : "Xác nhận từ chối"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh sách lead</h2>
            <p>Tìm kiếm theo tên/số điện thoại và lọc theo điều kiện.</p>
          </div>
          <div className="lead-list-header-actions">
            {canCreate && (
              <button
                type="button"
                className="lead-add-button"
                onClick={openCreateLead}
              >
                + Thêm lead
              </button>
            )}
            <div className="lead-view-switch" role="group" aria-label="Kiểu hiển thị lead">
              <button
                type="button"
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
              >
                Bảng trạng thái
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                Danh sách
              </button>
            </div>
          </div>
        </div>
        <div className="academic-filters lead-filters">
          <label>
            Tìm kiếm
            <div className="lead-search-box">
              <input
                placeholder="Nhập tên/SĐT rồi bấm Enter..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  className="lead-search-clear"
                  title="Xóa tìm kiếm"
                  onClick={() => {
                    setSearchInput("");
                    setFilters((current) => ({ ...current, search: "" }));
                  }}
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                className="lead-search-btn"
                title="Tìm kiếm"
                onClick={handleSearchSubmit}
              >
                🔍
              </button>
            </div>
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
              <option value="Đã liên hệ">Đã liên hệ</option>
              <option value="Đang tư vấn">Đang tư vấn</option>
              <option value="Hẹn học thử">Hẹn học thử</option>
              <option value="Chốt">Chốt</option>
              <option value="Từ chối">Từ chối</option>
              <option value="Đang liên hệ">Đang liên hệ (cũ)</option>
              <option value="Tiềm năng">Tiềm năng (cũ)</option>
              <option value="Không tiềm năng">Không tiềm năng (cũ)</option>
              <option value="Đã chuyển đổi">Đã chuyển đổi</option>
              <option value="Đã nhập học">Đã nhập học</option>
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
              <label htmlFor="bulk-consultant">Giao lead cho:</label>
              <select
                id="bulk-consultant"
                value={bulkConsultantId}
                onChange={(event) =>
                  setBulkConsultantId(event.target.value)
                }
              >
                <option value="">Chọn tư vấn viên hoặc thao tác</option>
                {consultants.map((consultant) => (
                  <option
                    key={consultant.nguoiDungId}
                    value={consultant.nguoiDungId}
                  >
                    {consultant.hoTen}
                  </option>
                ))}
                <option value="unassigned">Gỡ phân công</option>
              </select>
              <button
                type="button"
                className="lead-bulk-apply-btn"
                disabled={saving || bulkConsultantId === ""}
                onClick={() => void handleBulkAssign()}
              >
                {saving
                  ? "Đang lưu..."
                  : `Áp dụng phân công (${selectedLeadIds.length} lead)`}
              </button>
            </div>
          </div>
        )}
        {viewMode === "board" && (
          <div className="lead-status-board">
            {[
              ...LEAD_STATUS_COLUMNS,
              "Khác",
            ].map((column) => {
              const columnLeads = leads.filter((lead) =>
                column === "Khác"
                  ? !LEAD_STATUS_COLUMNS.includes(
                      lead.trangThai as (typeof LEAD_STATUS_COLUMNS)[number],
                    )
                  : lead.trangThai === column,
              );
              const draggedLead =
                draggedLeadId === null
                  ? null
                  : leads.find((lead) => lead.leadId === draggedLeadId) ?? null;
              return (
                <section
                  className={`lead-status-column ${
                    dragOverStatus === column ? "is-drop-target" : ""
                  }`}
                  key={column}
                  onDragOver={(event) => {
                    if (
                      draggedLead &&
                      !saving &&
                      canDropLeadIntoStatus(draggedLead, column)
                    ) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverStatus(column);
                    }
                  }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const lead = draggedLead;
                    setDragOverStatus(null);
                    setDraggedLeadId(null);
                    if (lead) void handleLeadDrop(lead, column);
                  }}
                >
                  <header>
                    <strong>{column}</strong>
                    <span>{columnLeads.length}</span>
                  </header>
                  {columnLeads.map((lead) => (
                    <article
                      className={`lead-status-card ${
                        lead.henGoiLaiQuaHan ? "is-overdue" : ""
                      } ${
                        draggedLeadId === lead.leadId ? "is-dragging" : ""
                      }`}
                      key={lead.leadId}
                      draggable={
                        canUpdate &&
                        !saving &&
                        (LEAD_STATUS_TRANSITIONS[lead.trangThai]?.length ?? 0) > 0
                      }
                      onDragStart={(event) => {
                        setDraggedLeadId(lead.leadId);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/plain",
                          String(lead.leadId),
                        );
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDragOverStatus(null);
                      }}
                    >
                      <strong>{lead.hoTen}</strong>
                      <small>{lead.soDienThoai}</small>
                      <small>{lead.tenChuongTrinh || "Chưa xác định chương trình"}</small>
                      {lead.henGoiLaiQuaHan && (
                        <span className="lead-overdue-badge">Quá hạn gọi lại</span>
                      )}
                      <div>
                        {canUpdate &&
                          !["Từ chối", "Đã nhập học"].includes(lead.trangThai) && (
                            <button type="button" onClick={() => editLead(lead)}>
                              Chuyển / sửa
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => openLeadHistory(lead)}
                        >
                          Nhật ký
                        </button>
                      </div>
                    </article>
                  ))}
                  {columnLeads.length === 0 && (
                    <p className="academic-muted">Không có lead.</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
        {viewMode === "table" && (
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                {canAssign && (
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={leads.some(
                        (lead) => !["Đã nhập học", "Từ chối"].includes(lead.trangThai),
                      ) &&
                        selectedLeadIds.length ===
                          leads.filter((lead) => !["Đã nhập học", "Từ chối"].includes(lead.trangThai))
                            .length}
                      disabled={leads.every((lead) =>
                          ["Đã nhập học", "Từ chối"].includes(lead.trangThai),
                      )}
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
                    <tr className={lead.henGoiLaiQuaHan ? "lead-row-overdue" : undefined}>
                      {canAssign && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.leadId)}
                            disabled={["Đã nhập học", "Từ chối"].includes(lead.trangThai)}
                            onChange={() => toggleSelectLead(lead.leadId)}
                            aria-label={`Chọn lead ${lead.hoTen}`}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{lead.hoTen}</strong>
                        {lead.maHocVien && (
                          <small className="admissions-student-code">
                            Mã học viên: {lead.maHocVien}
                          </small>
                        )}
                        <small className="academic-muted">{lead.soDienThoai}</small>
                        {lead.email && (
                          <small className="academic-muted">{lead.email}</small>
                        )}
                      </td>
                      <td>{lead.tenChuongTrinh || "Chưa xác định"}</td>
                      <td>
                        {lead.nguon}
                        <small className="academic-muted">{lead.trangThai}</small>
                        {lead.lyDoTuChoi && (
                          <small className="academic-muted">
                            Lý do: {lead.lyDoTuChoi}
                          </small>
                        )}
                        {lead.henGoiLaiQuaHan && (
                          <small className="lead-overdue-badge">
                            Quá hạn gọi lại
                          </small>
                        )}
                      </td>
                      <td>
                        {lead.nguoiPhuTrach.length > 0
                          ? lead.nguoiPhuTrach.map((person) => person.hoTen).join(", ")
                          : "Chưa phân công"}
                      </td>
                      <td>{new Date(lead.ngayTao).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <div className="lead-row-actions">
                          {canUpdate &&
                            !["Đã nhập học", "Từ chối"].includes(lead.trangThai) && (
                              <button type="button" onClick={() => editLead(lead)}>
                                Sửa
                              </button>
                            )}
                          {canUpdate &&
                            !["Đã nhập học", "Từ chối"].includes(lead.trangThai) && (
                              <button
                                type="button"
                                className="lead-convert-btn"
                                disabled={saving || !lead.email}
                                title={
                                  lead.email
                                    ? "Tạo hồ sơ học viên và gửi email kích hoạt"
                                    : "Cần bổ sung email trước khi chuyển thành học viên"
                                }
                                onClick={() => void convertLead(lead)}
                              >
                                Nhập học
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              historyLeadId === lead.leadId
                                ? setHistoryLeadId(null)
                                : openLeadHistory(lead)
                            }
                          >
                            Lịch sử
                          </button>
                          {canDelete &&
                            !["Đã nhập học", "Từ chối"].includes(lead.trangThai) && (
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
        )}
      </section>
      {historyLead && (
        <div
          className="lead-history-modal-backdrop"
          onClick={() => {
            if (!saving) setHistoryLeadId(null);
          }}
        >
          <section
            className="lead-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-history-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="lead-history-modal-header">
              <div>
                <h2 id="lead-history-modal-title">
                  Lịch sử lead: {historyLead.hoTen}
                </h2>
                <p>
                  Trạng thái hiện tại: <strong>{historyLead.trangThai}</strong>
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng lịch sử lead"
                disabled={saving}
                onClick={() => setHistoryLeadId(null)}
              >
                ×
              </button>
            </header>

            <div className="lead-history-modal-content">
              <div className="lead-history-modal-columns">
                <section>
                  <h3>Lịch sử trạng thái</h3>
                  {historyLead.lichSuTrangThai.length > 0 ? (
                    <ul className="lead-history">
                      {historyLead.lichSuTrangThai.map((entry, index) => (
                        <li key={`${historyLead.leadId}-status-${index}`}>
                          {entry.trangThaiCu ?? "Khởi tạo"} → {entry.trangThaiMoi}
                          {entry.lyDo ? ` — ${entry.lyDo}` : ""}
                          {" · "}
                          {new Date(entry.thoiDiem).toLocaleString("vi-VN")}
                          {entry.nguoiThucHien ? ` · ${entry.nguoiThucHien}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="academic-muted">Chưa có lịch sử trạng thái.</p>
                  )}
                </section>
                <section>
                  <h3>Nhật ký chăm sóc</h3>
                  {historyLead.tuongTacs.length > 0 ? (
                    <ul className="lead-history">
                      {historyLead.tuongTacs.map((entry) => (
                        <li
                          className={
                            entry.henGoiLaiQuaHan
                              ? "lead-interaction-overdue"
                              : undefined
                          }
                          key={entry.tuongTacId}
                        >
                          <strong>{entry.loai}</strong> — {entry.noiDung}
                          {" · "}
                          {new Date(entry.thoiDiem).toLocaleString("vi-VN")}
                          {entry.nguoiThucHien ? ` · ${entry.nguoiThucHien}` : ""}
                          {entry.henGoiLaiLuc && (
                            <>
                              {" · Gọi lại "}
                              {new Date(entry.henGoiLaiLuc).toLocaleString("vi-VN")}
                              {entry.henGoiLaiQuaHan && " (QUÁ HẠN)"}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="academic-muted">Chưa có tương tác.</p>
                  )}
                </section>
              </div>

              {canUpdate && availableStatusTransitions.length > 0 && (
                <form
                  className="lead-history-form"
                  onSubmit={(event) => void saveLeadStatus(event, historyLead)}
                >
                  <h3>Ghi nhận trạng thái</h3>
                  <label>
                    Trạng thái mới
                    <select
                      required
                      value={statusForm.trangThai}
                      onChange={(event) =>
                        setStatusForm({
                          ...statusForm,
                          trangThai: event.target.value,
                          lyDoTuChoi: "",
                        })
                      }
                    >
                      <option value="" disabled>
                        Chọn trạng thái
                      </option>
                      {availableStatusTransitions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  {statusForm.trangThai === "Từ chối" && (
                    <label>
                      Lý do từ chối *
                      <input
                        required
                        maxLength={500}
                        value={statusForm.lyDoTuChoi}
                        onChange={(event) =>
                          setStatusForm({
                            ...statusForm,
                            lyDoTuChoi: event.target.value,
                          })
                        }
                        placeholder="Nhập lý do từ chối"
                      />
                    </label>
                  )}
                  <button type="submit" disabled={saving || !statusForm.trangThai}>
                    {saving ? "Đang lưu..." : "Cập nhật trạng thái"}
                  </button>
                </form>
              )}

              {canUpdate &&
                !["Từ chối", "Đã nhập học"].includes(historyLead.trangThai) && (
                  <form
                    className="lead-interaction-form"
                    onSubmit={(event) => void saveInteraction(event, historyLead)}
                  >
                    <h3>Ghi tương tác</h3>
                    <label>
                      Hình thức
                      <select
                        value={interactionForm.loai}
                        onChange={(event) =>
                          setInteractionForm({
                            ...interactionForm,
                            loai: event.target.value,
                          })
                        }
                      >
                        <option value="Gọi">Gọi</option>
                        <option value="Nhắn tin">Nhắn tin</option>
                        <option value="Gặp">Gặp trực tiếp</option>
                      </select>
                    </label>
                    <label>
                      Nội dung
                      <input
                        required
                        maxLength={2000}
                        value={interactionForm.noiDung}
                        onChange={(event) =>
                          setInteractionForm({
                            ...interactionForm,
                            noiDung: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Thời điểm
                      <input
                        required
                        type="datetime-local"
                        value={interactionForm.thoiDiem}
                        onChange={(event) =>
                          setInteractionForm({
                            ...interactionForm,
                            thoiDiem: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Hẹn gọi lại
                      <input
                        type="datetime-local"
                        value={interactionForm.henGoiLaiLuc}
                        onChange={(event) =>
                          setInteractionForm({
                            ...interactionForm,
                            henGoiLaiLuc: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button type="submit" disabled={saving}>
                      {saving ? "Đang lưu..." : "Ghi tương tác"}
                    </button>
                  </form>
                )}

              <section>
                <h3>Lịch sử bàn giao</h3>
                {historyLead.lichSuBanGiao.length > 0 ? (
                  <ul className="lead-history">
                    {historyLead.lichSuBanGiao.map((entry, index) => (
                      <li key={`${historyLead.leadId}-handoff-${index}`}>
                        {entry.nguoiBanGiao ?? "Quản lý"} giao cho{" "}
                        {entry.nguoiNhan ?? "tư vấn viên"}
                        {" — "}
                        {new Date(entry.thoiGian).toLocaleString("vi-VN")}
                        {entry.ngayBoPhanCong &&
                          ` — Đã gỡ phân công: ${new Date(entry.ngayBoPhanCong).toLocaleString("vi-VN")}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="academic-muted">Chưa có lịch sử bàn giao.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdmissionsLeads;
