import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AcademicManagement.css";

interface UserOption {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  vaiTroIds?: number[];
}

interface SubjectOption {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
  soTinChi: number | null;
  giangViens?: Array<{
    giangVienId: number;
    hoTen: string;
    vaiTro: string;
  }>;
}

interface ClassRecord {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  namHoc: string;
  chuongTrinhId: number | null;
  maChuongTrinh: string | null;
  tenChuongTrinh: string | null;
  giangVienId: number | null;
  giangVienTen: string | null;
  canBanGiao: boolean;
  trangThai: string;
  hocVienIds: number[];
  hocViens: Array<
    UserOption & { ngayGhiDanh: string; nguoiGhiDanh: string | null }
  >;
  monHocIds: number[];
  monHocs: SubjectOption[];
  ngayKhaiGiang: string;
  siSoHienTai: number;
  siSoToiDa: number;
  canhBaoSiSo: boolean;
  hinhThuc: string;
  phongHocId: number | null;
  maPhong: string | null;
  tenPhong: string | null;
  sucChuaPhong: number | null;
  loaiPhong: "Trực tiếp" | "Trực tuyến" | null;
  canhBaoSucChuaPhong: boolean;
  linkTrucTuyen: string | null;
  tienDo: number;
  phanCongGiangVien: Array<{
    monHocId: number;
    giangVienId: number;
    vaiTro: "Chính" | "Trợ giảng";
  }>;
}

interface TrainingProgram {
  chuongTrinhId: number;
  maChuongTrinh: string;
  tenChuongTrinh: string;
  moTa: string | null;
  tongThoiLuong: number;
  hocPhiChuan: number;
  trangThai: string;
  soLop: number;
}

interface ClassOptions {
  giangViens: UserOption[];
  hocViens: UserOption[];
  monHocs: SubjectOption[];
  phongHocs: Array<{
    phongHocId: number;
    maPhong: string;
    tenPhong: string;
    sucChua: number;
    loaiPhong: "Trực tiếp" | "Trực tuyến";
  }>;
}

interface ClassEnrollmentResult {
  daGhiDanh: number[];
  siSoHienTai: number;
  siSoToiDa: number;
}

interface ClassForm {
  maLop: string;
  tenLop: string;
  namHoc: string;
  chuongTrinhId: number | "";
  giangVienId: number | "";
  hocVienIds: number[];
  monHocIds: number[];
  ngayKhaiGiang: string;
  siSoToiDa: number;
  hinhThuc: string;
  phongHocId: number | "";
  linkTrucTuyen: string;
  tienDo: number;
  trangThai: string;
  phanCongGiangVien: Array<{
    monHocId: number;
    giangVienId: number;
    vaiTro: "Chính" | "Trợ giảng";
  }>;
}

interface StudentProfile {
  hocVien: {
    nguoiDungId: number;
    hoTen: string;
    email: string;
    soDienThoai: string | null;
    ngaySinh: string | null;
    diaChi: string | null;
    trangThai: string;
  };
  lopHocs: ClassRecord[];
  diems: Array<{
    maLop: string;
    tenLop: string;
    maMonHoc: string;
    tenMonHoc: string;
    hocKy: number;
    namHoc: string;
    diemQuaTrinh: number | null;
    diemGiuaKy: number | null;
    diemCuoiKy: number | null;
  }>;
}

interface ClassManagementProps {
  permissions: string[];
  listOnly?: boolean;
}

const EMPTY_FORM: ClassForm = {
  maLop: "",
  tenLop: "",
  namHoc: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  chuongTrinhId: "",
  giangVienId: "",
  hocVienIds: [],
  monHocIds: [],
  ngayKhaiGiang: new Date().toISOString().slice(0, 10),
  siSoToiDa: 30,
  hinhThuc: "Trực tiếp",
  phongHocId: "",
  linkTrucTuyen: "",
  tienDo: 0,
  trangThai: "Chuẩn bị",
  phanCongGiangVien: [],
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

const ClassManagement: React.FC<ClassManagementProps> = ({
  permissions,
  listOnly = false,
}) => {
  const studentPickerRef = useRef<HTMLDetailsElement>(null);
  const classActionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const classActionsMenuRef = useRef<HTMLDivElement>(null);
  const canUpdateClasses = permissions.includes("CLASS_UPDATE");
  const canDeleteClasses = permissions.includes("CLASS_DELETE");
  const canCreateSubjects = permissions.includes("CLASS_CREATE");
  const canManageRows = canUpdateClasses || canDeleteClasses;
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const [options, setOptions] = useState<ClassOptions>({
    giangViens: [],
    hocViens: [],
    monHocs: [],
    phongHocs: [],
  });
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [isClassFormOpen, setIsClassFormOpen] = useState(false);
  const [isSubjectFormOpen, setIsSubjectFormOpen] = useState(false);
  const [classActionsMenu, setClassActionsMenu] = useState<{
    classId: number;
    top: number;
    left: number;
  } | null>(null);
  const [enrollmentClass, setEnrollmentClass] = useState<ClassRecord | null>(
    null,
  );
  const [enrollmentStudentIds, setEnrollmentStudentIds] = useState<number[]>(
    [],
  );
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    maMonHoc: "",
    tenMonHoc: "",
    soTinChi: "",
    soBuoi: "1",
    trongSo: "1",
    moTaChuanDauRa: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [roomForm, setRoomForm] = useState({
    maPhong: "",
    tenPhong: "",
    sucChua: 30,
    loaiPhong: "Trực tiếp" as "Trực tiếp" | "Trực tuyến",
  });
  const [isRoomFormOpen, setIsRoomFormOpen] = useState(false);

  const instructorOptions = useMemo(() => {
    const teachers = new Map<number, string>();
    classes.forEach((record) => {
      if (record.giangVienId && record.giangVienTen) {
        teachers.set(record.giangVienId, record.giangVienTen);
      }
      record.monHocs.forEach((subject) =>
        subject.giangViens?.forEach((teacher) =>
          teachers.set(teacher.giangVienId, teacher.hoTen),
        ),
      );
    });
    options.giangViens.forEach((teacher) =>
      teachers.set(teacher.nguoiDungId, teacher.hoTen),
    );
    return Array.from(teachers.entries()).sort((left, right) =>
      left[1].localeCompare(right[1], "vi"),
    );
  }, [classes, options.giangViens]);

  const filteredClasses = useMemo(() => {
    const searchTerm = classSearch.trim().toLocaleLowerCase("vi");
    return classes.filter((record) => {
      const matchesSearch =
        !searchTerm ||
        [
          record.maLop,
          record.tenLop,
          record.namHoc,
          record.giangVienTen ?? "",
          record.maPhong ?? "",
          record.tenPhong ?? "",
          record.maChuongTrinh ?? "",
          record.tenChuongTrinh ?? "",
          ...record.monHocs.map((subject) => subject.tenMonHoc),
        ]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(searchTerm);
      const matchesStatus = !statusFilter || record.trangThai === statusFilter;
      const matchesProgram =
        !programFilter || String(record.chuongTrinhId ?? "") === programFilter;
      const teacherIds = new Set(
        record.phanCongGiangVien.map((item) => item.giangVienId),
      );
      const matchesInstructor =
        !instructorFilter ||
        String(record.giangVienId ?? "") === instructorFilter ||
        teacherIds.has(Number(instructorFilter));
      const matchesStartDate =
        (!dateFromFilter || record.ngayKhaiGiang >= dateFromFilter) &&
        (!dateToFilter || record.ngayKhaiGiang <= dateToFilter);
      return (
        matchesSearch &&
        matchesStatus &&
        matchesProgram &&
        matchesInstructor &&
        matchesStartDate
      );
    });
  }, [
    classSearch,
    classes,
    dateFromFilter,
    dateToFilter,
    instructorFilter,
    programFilter,
    statusFilter,
  ]);

  const enrollmentCandidates = useMemo(() => {
    if (!enrollmentClass) return [];
    const enrolledIds = new Set(enrollmentClass.hocVienIds);
    const searchTerm = enrollmentSearch.trim().toLocaleLowerCase("vi");
    return options.hocViens.filter((student) => {
      if (enrolledIds.has(student.nguoiDungId)) return false;
      if (!searchTerm) return true;
      return `${student.hoTen} ${student.email}`
        .toLocaleLowerCase("vi")
        .includes(searchTerm);
    });
  }, [enrollmentClass, enrollmentSearch, options.hocViens]);

  useEffect(() => {
    const closeStudentPickerOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      const target = event.target;

      if (!studentPickerRef.current?.contains(target)) {
        studentPickerRef.current?.removeAttribute("open");
      }

      document
        .querySelectorAll<HTMLDetailsElement>(
          ".class-assistant-picker[open]",
        )
        .forEach((picker) => {
          if (!picker.contains(target)) {
            picker.removeAttribute("open");
          }
        });
    };

    document.addEventListener("mousedown", closeStudentPickerOnOutsideClick);
    return () => {
      document.removeEventListener(
        "mousedown",
        closeStudentPickerOnOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    if (!classActionsMenu) return;

    const closeMenu = () => setClassActionsMenu(null);
    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        !classActionsTriggerRef.current?.contains(event.target) &&
        !classActionsMenuRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("mousedown", closeMenuOnOutsideClick);
      document.removeEventListener("keydown", closeMenuOnEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [classActionsMenu]);

  const loadData = async () => {
    try {
      const classResponse = await api.get<ClassRecord[]>("/academic/classes", {
        params: { include_inactive: true },
      });
      setClasses(classResponse.data);
      if (canUpdateClasses) {
        const optionsResponse =
          await api.get<ClassOptions>("/academic/class-options");
        setOptions(optionsResponse.data);
      }
      const programResponse =
        await api.get<TrainingProgram[]>("/academic/programs");
      setTrainingPrograms(programResponse.data);
      setErrorMessage("");
    } catch (error: unknown) {
      console.error("Không thể tải dữ liệu quản lý lớp:", error);
      setErrorMessage(
        responseError(error, "Không thể tải danh sách lớp và danh mục đào tạo."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const classResponse = await api.get<ClassRecord[]>("/academic/classes", {
          params: { include_inactive: true },
        });
        const optionsResponse = canUpdateClasses
          ? await api.get<ClassOptions>("/academic/class-options")
          : null;
        const programResponse =
          await api.get<TrainingProgram[]>("/academic/programs");
        if (active) {
          setClasses(classResponse.data);
          if (optionsResponse) setOptions(optionsResponse.data);
          setTrainingPrograms(programResponse.data);
          setErrorMessage("");
        }
      } catch (error: unknown) {
        console.error("Không thể tải dữ liệu quản lý lớp:", error);
        if (active) {
          setErrorMessage(
            responseError(
              error,
              "Không thể tải danh sách lớp và danh mục đào tạo.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialLoad();
    return () => {
      active = false;
    };
  }, [canUpdateClasses, listOnly]);

  const loadStudentProfile = async (studentId: number) => {
    try {
      const response = await api.get<StudentProfile>(
        `/academic/students/${studentId}`,
      );
      setStudentProfile(response.data);
      setErrorMessage("");
    } catch (error: unknown) {
      console.error("Không thể tải hồ sơ học viên:", error);
      setErrorMessage(responseError(error, "Không thể tải hồ sơ học viên."));
    }
  };

  const saveRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await api.post("/academic/rooms", roomForm);
      setIsRoomFormOpen(false);
      setRoomForm({
        maPhong: "",
        tenPhong: "",
        sucChua: 30,
        loaiPhong: "Trực tiếp",
      });
      setSuccessMessage("Thêm phòng thành công.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể lưu phòng học:", error);
      setErrorMessage(responseError(error, "Không thể lưu phòng học."));
    } finally {
      setSaving(false);
    }
  };

  const openEnrollment = (record: ClassRecord) => {
    setClassActionsMenu(null);
    setEnrollmentClass(record);
    setEnrollmentStudentIds([]);
    setEnrollmentSearch("");
    setEnrollmentError("");
  };

  const toggleClassActions = (
    event: React.MouseEvent<HTMLButtonElement>,
    record: ClassRecord,
  ) => {
    if (classActionsMenu?.classId === record.lopHocId) {
      setClassActionsMenu(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const menuWidth = 144;
    const menuHeight =
      (Number(canUpdateClasses) * 2 + Number(canDeleteClasses)) * 36 + 16;
    const top =
      bounds.bottom + menuHeight + 8 <= window.innerHeight
        ? bounds.bottom + 6
        : Math.max(8, bounds.top - menuHeight - 6);
    classActionsTriggerRef.current = event.currentTarget;
    setClassActionsMenu({
      classId: record.lopHocId,
      top,
      left: Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  };

  const closeEnrollment = () => {
    if (enrolling) return;
    setEnrollmentClass(null);
    setEnrollmentStudentIds([]);
    setEnrollmentSearch("");
    setEnrollmentError("");
  };

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enrollmentClass || enrollmentStudentIds.length === 0) return;
    setEnrolling(true);
    setEnrollmentError("");
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await api.post<ClassEnrollmentResult>(
        `/academic/classes/${enrollmentClass.lopHocId}/enrollments`,
        { hocVienIds: enrollmentStudentIds },
      );
      setSuccessMessage(
        `Đã ghi danh ${response.data.daGhiDanh.length} học viên vào lớp ${enrollmentClass.maLop}.`,
      );
      setEnrollmentClass(null);
      setEnrollmentStudentIds([]);
      void loadData();
    } catch (error: unknown) {
      console.error("Không thể ghi danh học viên vào lớp:", error);
      setEnrollmentError(
        responseError(error, "Không thể ghi danh học viên vào lớp."),
      );
    } finally {
      setEnrolling(false);
    }
  };

  const openCreateRoomForm = () => {
    setRoomForm({
      maPhong: "",
      tenPhong: "",
      sucChua: 30,
      loaiPhong: "Trực tiếp",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsRoomFormOpen(true);
  };

  const closeRoomForm = () => {
    if (saving) return;
    setIsRoomFormOpen(false);
    setRoomForm({
      maPhong: "",
      tenPhong: "",
      sucChua: 30,
      loaiPhong: "Trực tiếp",
    });
    setErrorMessage("");
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingClassId(null);
    setIsClassFormOpen(false);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const openCreateClassForm = () => {
    setForm(EMPTY_FORM);
    setEditingClassId(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsClassFormOpen(true);
  };

  const saveClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = editingClassId !== null;
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      const payload = {
        ...form,
        chuongTrinhId:
          form.chuongTrinhId === "" ? null : form.chuongTrinhId,
        giangVienId: form.giangVienId === "" ? null : form.giangVienId,
        phongHocId: form.phongHocId === "" ? null : form.phongHocId,
        linkTrucTuyen: form.linkTrucTuyen || null,
      };

      if (editingClassId === null) {
        await api.post("/academic/classes", payload);
      } else {
        await api.put(`/academic/classes/${editingClassId}`, payload);
      }
      resetForm();
      setSuccessMessage(
        isEditing ? "Cập nhật lớp thành công." : "Tạo lớp thành công.",
      );
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể lưu lớp học:", error);
      setErrorMessage(responseError(error, "Không thể lưu lớp học."));
    } finally {
      setSaving(false);
    }
  };

  const editClass = (record: ClassRecord) => {
    setForm({
      maLop: record.maLop,
      tenLop: record.tenLop,
      namHoc: record.namHoc,
      chuongTrinhId: record.chuongTrinhId ?? "",
      giangVienId: record.giangVienId ?? "",
      hocVienIds: record.hocVienIds,
      monHocIds: record.monHocIds,
      ngayKhaiGiang: record.ngayKhaiGiang,
      siSoToiDa: record.siSoToiDa,
      hinhThuc: record.hinhThuc as ClassForm["hinhThuc"],
      phongHocId: record.phongHocId ?? "",
      linkTrucTuyen: record.linkTrucTuyen ?? "",
      tienDo: record.tienDo,
      trangThai: record.trangThai,
      phanCongGiangVien: record.phanCongGiangVien,
    });
    setEditingClassId(record.lopHocId);
    setErrorMessage("");
    setSuccessMessage("");
    setIsClassFormOpen(true);
  };

  const archiveClass = async (record: ClassRecord) => {
    if (
      !window.confirm(
        `Ngừng hoạt động lớp ${record.maLop}? Thông tin lớp và điểm sẽ được giữ lại.`,
      )
    ) {
      return;
    }
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await api.delete(`/academic/classes/${record.lopHocId}`);
      setSuccessMessage("Đã ngừng hoạt động lớp học.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể lưu trữ lớp học:", error);
      setErrorMessage(responseError(error, "Không thể ngừng hoạt động lớp."));
    }
  };

  const saveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      await api.post("/academic/subjects", {
        maMonHoc: subjectForm.maMonHoc,
        tenMonHoc: subjectForm.tenMonHoc,
        soTinChi: subjectForm.soTinChi ? Number(subjectForm.soTinChi) : null,
        soBuoi: Number(subjectForm.soBuoi),
        trongSo: Number(subjectForm.trongSo),
        moTaChuanDauRa: subjectForm.moTaChuanDauRa || null,
      });
      setIsSubjectFormOpen(false);
      setSubjectForm({
        maMonHoc: "",
        tenMonHoc: "",
        soTinChi: "",
        soBuoi: "1",
        trongSo: "1",
        moTaChuanDauRa: "",
      });
      setSuccessMessage("Thêm môn học thành công.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể thêm môn học:", error);
      setErrorMessage(responseError(error, "Không thể thêm môn học."));
    } finally {
      setSaving(false);
    }
  };

  const openSubjectForm = () => {
    setSubjectForm({
      maMonHoc: "",
      tenMonHoc: "",
      soTinChi: "",
      soBuoi: "1",
      trongSo: "1",
      moTaChuanDauRa: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubjectFormOpen(true);
  };

  const closeSubjectForm = () => {
    if (saving) return;
    setIsSubjectFormOpen(false);
    setErrorMessage("");
  };

  const selectedProgram = trainingPrograms.find(
    (program) => program.chuongTrinhId === form.chuongTrinhId,
  );
  const enrollmentSeatsRemaining = enrollmentClass
    ? Math.max(
        0,
        Math.min(
          enrollmentClass.siSoToiDa,
          enrollmentClass.sucChuaPhong ?? enrollmentClass.siSoToiDa,
        ) - enrollmentClass.siSoHienTai,
      )
    : 0;

  return (
    <section className="academic-page class-management-page">
      {(errorMessage || successMessage) && (
        <ToastNotification
          type={successMessage ? "success" : "error"}
          text={successMessage || errorMessage}
          durationMs={3000}
          onClose={() => {
            setSuccessMessage("");
            setErrorMessage("");
          }}
        />
      )}

      {classActionsMenu &&
        createPortal(
          <div
            id={`class-actions-menu-${classActionsMenu.classId}`}
            ref={classActionsMenuRef}
            className="class-actions-menu"
            role="menu"
            aria-label="Tác vụ lớp học"
            style={{
              top: classActionsMenu.top,
              left: classActionsMenu.left,
            }}
          >
            {classes
              .filter(
                (record) => record.lopHocId === classActionsMenu.classId,
              )
              .map((record) => (
                <div key={record.lopHocId} className="class-actions-menu-items">
                  {canUpdateClasses && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="academic-text-button"
                        onClick={() => {
                          setClassActionsMenu(null);
                          editClass(record);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="academic-primary-button class-enrollment-open"
                        disabled={record.siSoHienTai >= record.siSoToiDa}
                        title={
                          record.siSoHienTai >= record.siSoToiDa
                            ? "Lớp đã đủ sĩ số"
                            : "Ghi danh một hoặc nhiều học viên"
                        }
                        onClick={() => openEnrollment(record)}
                      >
                        Ghi danh
                      </button>
                    </>
                  )}
                  {canDeleteClasses && (
                    <button
                      type="button"
                      role="menuitem"
                      className="academic-danger-button"
                      onClick={() => {
                        setClassActionsMenu(null);
                        void archiveClass(record);
                      }}
                    >
                      Ngừng
                    </button>
                  )}
                </div>
              ))}
          </div>,
          document.body,
        )}

      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">
            <span aria-hidden="true">🎓</span>
            ĐÀO TẠO
          </div>
          <h1>
            {listOnly
              ? "Danh sách lớp"
              : canUpdateClasses
                ? "Quản lý lớp"
                : "Xem lớp"}
          </h1>
          <p>
            {listOnly
              ? "Tìm kiếm và lọc lớp theo mã, tên, năm học, giảng viên hoặc môn học."
              : canUpdateClasses
              ? "Tổ chức lớp, phân công giảng viên, môn học và danh sách học viên."
              : "Danh sách lớp được phân công hoặc ghi danh cùng thông tin môn học."}
          </p>
        </div>
        <div className="academic-banner-stat">
          <strong>{classes.length}</strong>
          <span>Lớp học</span>
        </div>
      </header>

      {canUpdateClasses &&
        enrollmentClass &&
        createPortal(
          <div
            className="academic-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEnrollment();
            }}
          >
            <form
              className="academic-modal class-enrollment-modal"
              onSubmit={submitEnrollment}
            >
              <div className="academic-modal-heading">
                <div>
                  <h3>Ghi danh học viên</h3>
                  <p>
                    {enrollmentClass.maLop} · Còn {enrollmentSeatsRemaining} chỗ
                    trống. Có thể chọn một hoặc nhiều học viên.
                  </p>
                </div>
                <button
                  type="button"
                  className="academic-modal-close"
                  onClick={closeEnrollment}
                  disabled={enrolling}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
              {enrollmentError && (
                <div
                  className="academic-alert academic-alert-error"
                  role="alert"
                >
                  {enrollmentError}
                </div>
              )}
              <label className="class-enrollment-search">
                Tìm học viên
                <input
                  autoFocus
                  type="search"
                  placeholder="Nhập tên hoặc email"
                  value={enrollmentSearch}
                  onChange={(event) => setEnrollmentSearch(event.target.value)}
                />
              </label>
              <div className="class-enrollment-selection">
                <span>
                  Đã chọn {enrollmentStudentIds.length}/{enrollmentSeatsRemaining}
                  {" "}học viên
                </span>
                <button
                  type="button"
                  className="academic-text-button"
                  disabled={
                    enrollmentSeatsRemaining === 0 ||
                    enrollmentCandidates.length === 0
                  }
                  onClick={() => {
                    const remaining = Math.max(
                      0,
                      enrollmentSeatsRemaining - enrollmentStudentIds.length,
                    );
                    const selected = new Set(enrollmentStudentIds);
                    const candidatesToAdd = enrollmentCandidates
                      .filter((student) => !selected.has(student.nguoiDungId))
                      .slice(0, remaining)
                      .map((student) => student.nguoiDungId);
                    setEnrollmentStudentIds((current) => [
                      ...current,
                      ...candidatesToAdd,
                    ]);
                  }}
                >
                  Chọn học viên hiển thị
                </button>
              </div>
              <div className="class-enrollment-candidates">
                {enrollmentCandidates.length ? (
                  enrollmentCandidates.map((student) => {
                    const checked = enrollmentStudentIds.includes(
                      student.nguoiDungId,
                    );
                    return (
                      <label
                        className="class-enrollment-candidate"
                        key={student.nguoiDungId}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            !checked &&
                            enrollmentStudentIds.length >=
                              enrollmentSeatsRemaining
                          }
                          onChange={(event) => {
                            setEnrollmentStudentIds((current) =>
                              event.target.checked
                                ? current.length < enrollmentSeatsRemaining
                                  ? [...current, student.nguoiDungId]
                                  : current
                                : current.filter(
                                    (id) => id !== student.nguoiDungId,
                                  ),
                            );
                          }}
                        />
                        <span>
                          <strong>{student.hoTen}</strong>
                          <small>{student.email}</small>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="class-enrollment-empty">
                    {enrollmentSeatsRemaining === 0
                      ? "Lớp đã đủ sĩ số."
                      : "Không có học viên phù hợp hoặc mọi học viên đang hiển thị đã ở trong lớp."}
                  </p>
                )}
              </div>
              <div className="academic-modal-actions">
                <button
                  type="button"
                  className="academic-secondary-button"
                  onClick={closeEnrollment}
                  disabled={enrolling}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="academic-primary-button class-enrollment-submit"
                  disabled={enrolling || enrollmentStudentIds.length === 0}
                >
                  {enrolling ? "Đang ghi danh..." : "Xác nhận ghi danh"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {canUpdateClasses &&
        isClassFormOpen &&
        createPortal(
          <div
            className="academic-modal-backdrop class-entry-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) {
                resetForm();
              }
            }}
          >
            <form
              className="academic-modal class-entry-modal"
              onSubmit={saveClass}
            >
        <div className="academic-card-heading">
          <div>
            <h2>{editingClassId === null ? "Thông tin lớp" : "Cập nhật lớp"}</h2>
            <p>Học viên và môn học chỉ được chọn từ danh mục đang hoạt động.</p>
          </div>
          <button
            type="button"
            className="academic-modal-close"
            onClick={resetForm}
            disabled={saving}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <div className="academic-form-grid">
          <label>
            Chương trình đào tạo
            <select
              required={editingClassId === null}
              value={form.chuongTrinhId}
              onChange={(event) => {
                const programId = event.target.value
                  ? Number(event.target.value)
                  : "";
                const program = trainingPrograms.find(
                  (item) => item.chuongTrinhId === programId,
                );
                setForm((current) => ({
                  ...current,
                  chuongTrinhId: programId,
                  tenLop: program?.tenChuongTrinh ?? "",
                }));
              }}
            >
              <option value="">
                {editingClassId === null
                  ? "Chọn chương trình"
                  : "Không gắn chương trình"}
              </option>
              {trainingPrograms
                .filter(
                  (program) =>
                    program.trangThai === "Đang áp dụng" ||
                    program.chuongTrinhId === form.chuongTrinhId,
                )
                .map((program) => (
                  <option
                    key={program.chuongTrinhId}
                    value={program.chuongTrinhId}
                  >
                    {program.maChuongTrinh} — {program.tenChuongTrinh}
                    {program.trangThai !== "Đang áp dụng"
                      ? " (Ngừng áp dụng)"
                      : ""}
                  </option>
                ))}
            </select>
            {selectedProgram && (
              <small>
                {selectedProgram.tongThoiLuong} giờ · Học phí chuẩn{" "}
                {new Intl.NumberFormat("vi-VN").format(
                  selectedProgram.hocPhiChuan,
                )}{" "}
₫
              </small>
            )}
          </label>
          <label>
            Mã lớp
            <input
              required
              value={form.maLop}
              maxLength={30}
              onChange={(event) =>
                setForm((current) => ({ ...current, maLop: event.target.value }))
              }
            />
          </label>
          <label>
            Tên lớp
            <input
              required
              value={form.tenLop}
              maxLength={150}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tenLop: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Năm học
            <input
              required
              pattern="\d{4}-\d{4}"
              placeholder="2025-2026"
              value={form.namHoc}
              onChange={(event) =>
                setForm((current) => ({ ...current, namHoc: event.target.value }))
              }
            />
          </label>
          <label>
            Giảng viên chính mặc định
            <select
              value={form.giangVienId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  giangVienId: event.target.value
                    ? Number(event.target.value)
                    : "",
                }))
              }
            >
              <option value="">Chưa phân công</option>
              {options.giangViens
                .filter((teacher) => teacher.vaiTroIds?.includes(3))
                .map((teacher) => (
                <option key={teacher.nguoiDungId} value={teacher.nguoiDungId}>
                  {teacher.hoTen}
                </option>
                ))}
            </select>
          </label>
          <label>
            Ngày khai giảng dự kiến
            <input
              required
              type="date"
              value={form.ngayKhaiGiang}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ngayKhaiGiang: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Sĩ số tối đa
            <input
              required
              type="number"
              min={1}
              max={500}
              value={form.siSoToiDa}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  siSoToiDa: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Trạng thái lớp
            <select
              value={form.trangThai}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  trangThai: event.target.value,
                }))
              }
            >
              {[
                "Chuẩn bị",
                "Đang học",
                "Kết thúc",
                "Hủy",
                ...(form.trangThai === "Đang hoạt động"
                  ? ["Đang hoạt động"]
                  : []),
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tiến độ buổi học (%)
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.tienDo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tienDo: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Hình thức học
            <select
              value={form.hinhThuc}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hinhThuc: event.target.value,
                }))
              }
            >
              <option value="Trực tiếp">Trực tiếp</option>
              <option value="Trực tuyến">Trực tuyến</option>
              <option value="Kết hợp">Kết hợp</option>
            </select>
          </label>
          <label>
            {form.hinhThuc === "Trực tuyến"
              ? "Phòng học trực tuyến"
              : "Phòng học trực tiếp"}
            <select
              value={form.phongHocId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phongHocId: event.target.value
                    ? Number(event.target.value)
                    : "",
                }))
              }
            >
              <option value="">Chưa xếp phòng</option>
              {options.phongHocs
                .filter((room) =>
                  form.hinhThuc === "Trực tuyến"
                    ? room.loaiPhong === "Trực tuyến"
                    : room.loaiPhong === "Trực tiếp",
                )
                .map((room) => (
                  <option key={room.phongHocId} value={room.phongHocId}>
                    {room.maPhong} — {room.tenPhong} (sức chứa {room.sucChua})
                  </option>
                ))}
            </select>
          </label>
          {form.hinhThuc !== "Trực tiếp" && (
            <label>
              Liên kết học trực tuyến
              <input
                type="url"
                required={form.hinhThuc === "Trực tuyến"}
                maxLength={500}
                value={form.linkTrucTuyen}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    linkTrucTuyen: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </label>
          )}
          <div className="academic-student-field">
            <span className="academic-field-label">Học viên</span>
            <details
              className="academic-multi-select"
              ref={studentPickerRef}
            >
              <summary>
                {form.hocVienIds.length === 0
                  ? "Chọn học viên"
                  : `Đã chọn ${form.hocVienIds.length} học viên`}
                <span aria-hidden="true">▾</span>
              </summary>
              <div className="academic-student-picker academic-subject-picker">
                {options.hocViens.length === 0 ? (
                  <span className="academic-empty-options">
                    Chưa có học viên đang hoạt động.
                  </span>
                ) : (
                  <>
                    <label className="academic-student-option academic-select-all">
                      <input
                        type="checkbox"
                        checked={
                          options.hocViens.length > 0 &&
                          options.hocViens.every((student) =>
                            form.hocVienIds.includes(student.nguoiDungId),
                          )
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            hocVienIds: event.target.checked
                              ? options.hocViens.map(
                                  (student) => student.nguoiDungId,
                                )
                              : [],
                          }))
                        }
                      />
                      <span>Chọn tất cả học viên</span>
                    </label>
                    {options.hocViens.map((student) => (
                      <label
                        className="academic-student-option"
                        key={student.nguoiDungId}
                      >
                        <input
                          type="checkbox"
                          checked={form.hocVienIds.includes(student.nguoiDungId)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              hocVienIds: event.target.checked
                                ? [...current.hocVienIds, student.nguoiDungId]
                                : current.hocVienIds.filter(
                                    (id) => id !== student.nguoiDungId,
                                  ),
                            }))
                          }
                        />
                        <span>{student.hoTen}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </details>
          </div>
          <fieldset className="academic-wide-field class-subject-assignments">
            <legend>Môn học và phân công giảng viên theo môn</legend>
            {options.monHocs.length === 0 ? (
              <p className="academic-muted">Chưa có môn học đang hoạt động.</p>
            ) : (
              options.monHocs.map((subject) => {
                const selected = form.monHocIds.includes(subject.monHocId);
                const primary = form.phanCongGiangVien.find(
                  (assignment) =>
                    assignment.monHocId === subject.monHocId &&
                    assignment.vaiTro === "Chính",
                );
                const assistants = form.phanCongGiangVien.filter(
                  (assignment) =>
                    assignment.monHocId === subject.monHocId &&
                    assignment.vaiTro === "Trợ giảng",
                );
                return (
                  <div className="class-subject-assignment" key={subject.monHocId}>
                    <label className="academic-student-option">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            monHocIds: event.target.checked
                              ? [...current.monHocIds, subject.monHocId]
                              : current.monHocIds.filter(
                                  (id) => id !== subject.monHocId,
                                ),
                            phanCongGiangVien: event.target.checked
                              ? current.phanCongGiangVien
                              : current.phanCongGiangVien.filter(
                                  (assignment) =>
                                    assignment.monHocId !== subject.monHocId,
                                ),
                          }))
                        }
                      />
                      <span>
                        {subject.maMonHoc} — {subject.tenMonHoc}
                      </span>
                    </label>
                    {selected && (
                      <div className="class-subject-teachers">
                        <label>
                          Giảng viên chính
                          <select
                            required={!primary && !form.giangVienId}
                            value={primary?.giangVienId ?? form.giangVienId}
                            onChange={(event) => {
                              const teacherId = Number(event.target.value);
                              setForm((current) => ({
                                ...current,
                                phanCongGiangVien: [
                                  ...current.phanCongGiangVien.filter(
                                    (assignment) =>
                                      assignment.monHocId !== subject.monHocId ||
                                      assignment.vaiTro !== "Chính",
                                  ),
                                  ...(teacherId
                                    ? [{
                                        monHocId: subject.monHocId,
                                        giangVienId: teacherId,
                                        vaiTro: "Chính" as const,
                                      }]
                                    : []),
                                ],
                              }));
                            }}
                          >
                            <option value="">Chọn giảng viên chính</option>
                            {options.giangViens
                              .filter((teacher) =>
                                teacher.vaiTroIds?.includes(3),
                              )
                              .map((teacher) => (
                                <option
                                  key={teacher.nguoiDungId}
                                  value={teacher.nguoiDungId}
                                >
                                  {teacher.hoTen}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="academic-student-field">
                          <span className="academic-field-label">Trợ giảng</span>
                          <details className="academic-multi-select class-assistant-picker">
                            <summary>
                              {assistants.length
                                ? `Đã chọn ${assistants.length} trợ giảng`
                                : "Chọn trợ giảng"}
                              <span aria-hidden="true">▾</span>
                            </summary>
                            <div className="academic-student-picker academic-subject-picker">
                              {options.giangViens
                                .filter((teacher) =>
                                  teacher.vaiTroIds?.includes(4),
                                )
                                .map((teacher) => (
                                  <label
                                    className="academic-student-option"
                                    key={teacher.nguoiDungId}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={assistants.some(
                                        (assignment) =>
                                          assignment.giangVienId ===
                                          teacher.nguoiDungId,
                                      )}
                                      onChange={(event) =>
                                        setForm((current) => ({
                                          ...current,
                                          phanCongGiangVien: event.target.checked
                                            ? [
                                                ...current.phanCongGiangVien,
                                                {
                                                  monHocId: subject.monHocId,
                                                  giangVienId:
                                                    teacher.nguoiDungId,
                                                  vaiTro: "Trợ giảng",
                                                },
                                              ]
                                            : current.phanCongGiangVien.filter(
                                                (assignment) =>
                                                  assignment.monHocId !==
                                                    subject.monHocId ||
                                                  assignment.giangVienId !==
                                                    teacher.nguoiDungId,
                                              ),
                                        }))
                                      }
                                    />
                                    <span>{teacher.hoTen}</span>
                                  </label>
                                ))}
                            </div>
                          </details>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </fieldset>
        </div>
        <div className="academic-form-actions">
          <button
            className="academic-secondary-button"
            type="button"
            onClick={resetForm}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            className="academic-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Đang lưu..."
              : editingClassId === null
                ? "Tạo lớp"
                : "Lưu thay đổi"}
          </button>
        </div>
            </form>
          </div>,
          document.body,
        )}

      {!listOnly &&
        isRoomFormOpen &&
        canCreateSubjects &&
        createPortal(
          <div
            className="academic-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeRoomForm();
            }}
          >
            <form
              className="academic-modal room-entry-modal"
              onSubmit={saveRoom}
            >
              <div className="academic-modal-heading">
                <div>
                  <h3>Thêm phòng học</h3>
                  <p>Khai báo loại phòng và sức chứa tối đa.</p>
                </div>
                <button
                  type="button"
                  className="academic-modal-close"
                  onClick={closeRoomForm}
                  disabled={saving}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
              {errorMessage && (
                <div
                  className="academic-alert academic-alert-error"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
              <div className="academic-form-grid">
                <label>
                  Mã phòng
                  <input
                    required
                    maxLength={30}
                    value={roomForm.maPhong}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        maPhong: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Tên phòng
                  <input
                    required
                    maxLength={100}
                    value={roomForm.tenPhong}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        tenPhong: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Loại phòng
                  <select
                    value={roomForm.loaiPhong}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        loaiPhong: event.target.value as
                          | "Trực tiếp"
                          | "Trực tuyến",
                      }))
                    }
                  >
                    <option value="Trực tiếp">Trực tiếp</option>
                    <option value="Trực tuyến">Trực tuyến</option>
                  </select>
                </label>
                <label>
                  Sức chứa
                  <input
                    required
                    type="number"
                    min={1}
                    max={1000}
                    value={roomForm.sucChua}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        sucChua: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="academic-form-actions">
                <button
                  className="academic-secondary-button"
                  type="button"
                  onClick={closeRoomForm}
                  disabled={saving}
                >
                  Hủy
                </button>
                <button
                  className="academic-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Thêm phòng"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {studentProfile && (
        <section className="academic-card student-academic-profile">
          <div className="academic-card-heading">
            <div>
              <h2>Hồ sơ học viên — {studentProfile.hocVien.hoTen}</h2>
              <p>
                {studentProfile.hocVien.email} ·{" "}
                {studentProfile.hocVien.soDienThoai || "Chưa có số điện thoại"} ·{" "}
                {studentProfile.hocVien.trangThai}
              </p>
            </div>
            <button
              className="academic-secondary-button"
              type="button"
              onClick={() => setStudentProfile(null)}
            >
              Đóng hồ sơ
            </button>
          </div>
          <h3>Quá trình lớp học</h3>
          {studentProfile.lopHocs.map((record) => {
            const student = record.hocViens.find(
              (item) =>
                item.nguoiDungId === studentProfile.hocVien.nguoiDungId,
            );
            return (
              <p key={record.lopHocId}>
                {record.maLop} — {record.tenLop} · {record.trangThai} · ghi danh{" "}
                {student?.ngayGhiDanh
                  ? new Date(student.ngayGhiDanh).toLocaleDateString("vi-VN")
                  : ""}
              </p>
            );
          })}
          <h3>Điểm</h3>
          {studentProfile.diems.length ? (
            <div className="academic-table-wrap">
              <table className="academic-table">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Môn</th>
                    <th>Học kỳ</th>
                    <th>Quá trình</th>
                    <th>Giữa kỳ</th>
                    <th>Cuối kỳ</th>
                  </tr>
                </thead>
                <tbody>
                  {studentProfile.diems.map((grade, index) => (
                    <tr key={`${grade.maLop}-${grade.maMonHoc}-${index}`}>
                      <td>{grade.maLop}</td>
                      <td>{grade.tenMonHoc}</td>
                      <td>{grade.hocKy} · {grade.namHoc}</td>
                      <td>{grade.diemQuaTrinh ?? "—"}</td>
                      <td>{grade.diemGiuaKy ?? "—"}</td>
                      <td>{grade.diemCuoiKy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="academic-muted">Chưa có điểm được ghi nhận.</p>
          )}
        </section>
      )}

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh sách lớp</h2>
            <p>
              {listOnly
                ? `Hiển thị ${filteredClasses.length} / ${classes.length} lớp`
                : `${classes.length} lớp trong hệ thống`}
            </p>
          </div>
          {!listOnly && (canUpdateClasses || canCreateSubjects) && (
            <div className="academic-actions">
              {canUpdateClasses && (
                <button
                  className="academic-primary-button"
                  type="button"
                  onClick={openCreateClassForm}
                >
                  + Tạo lớp
                </button>
              )}
              {canCreateSubjects && (
                <button
                  className="academic-secondary-button"
                  type="button"
                  onClick={openSubjectForm}
                >
                  + Thêm môn học
                </button>
              )}
              {canCreateSubjects && (
                <button
                  className="academic-secondary-button"
                  type="button"
                  onClick={openCreateRoomForm}
                >
                  + Thêm phòng học
                </button>
              )}
            </div>
          )}
        </div>
        <div className="academic-filters class-filters">
            <label>
              Tìm kiếm lớp
              <input
                type="search"
                value={classSearch}
                onChange={(event) => setClassSearch(event.target.value)}
                placeholder="Mã/tên lớp, năm học, giảng viên, môn học..."
              />
            </label>
            <label>
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Chuẩn bị">Chuẩn bị</option>
                <option value="Đang học">Đang học</option>
                <option value="Kết thúc">Kết thúc</option>
                <option value="Hủy">Hủy</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Ngừng hoạt động">Ngừng hoạt động</option>
              </select>
            </label>
            <label>
              Chương trình
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
              >
                <option value="">Tất cả chương trình</option>
                {trainingPrograms.map((program) => (
                  <option
                    key={program.chuongTrinhId}
                    value={program.chuongTrinhId}
                  >
                    {program.maChuongTrinh} — {program.tenChuongTrinh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Giảng viên
              <select
                value={instructorFilter}
                onChange={(event) => setInstructorFilter(event.target.value)}
              >
                <option value="">Tất cả giảng viên</option>
                {instructorOptions.map(([teacherId, teacherName]) => (
                  <option key={teacherId} value={teacherId}>
                    {teacherName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Khai giảng từ
              <input
                type="date"
                value={dateFromFilter}
                onChange={(event) => setDateFromFilter(event.target.value)}
              />
            </label>
            <label>
              Khai giảng đến
              <input
                type="date"
                value={dateToFilter}
                onChange={(event) => setDateToFilter(event.target.value)}
              />
            </label>
          </div>
        <div className="academic-table-wrap class-list-table-wrap">
          <table className="academic-table class-list-table">
            <thead>
              <tr>
                <th>Mã / tên lớp</th>
                <th>Năm học</th>
                <th>Giảng viên</th>
                <th>Sĩ số / hồ sơ</th>
                <th>Môn học</th>
                <th>Tiến độ / phòng</th>
                <th>Trạng thái</th>
                {canManageRows && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManageRows ? 8 : 7}>
                    Đang tải danh sách lớp...
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={canManageRows ? 8 : 7}>
                    {classes.length === 0
                      ? "Chưa có lớp học."
                      : "Không tìm thấy lớp phù hợp."}
                  </td>
                </tr>
              ) : (
                filteredClasses.map((record) => (
                  <tr key={record.lopHocId}>
                    <td>
                      <strong>{record.maLop}</strong>
                      <span className="academic-cell-subtitle">
                        {record.tenLop}
                      </span>
                      {record.maChuongTrinh && (
                        <span className="academic-cell-subtitle">
                          Chương trình: {record.maChuongTrinh}
                        </span>
                      )}
                    </td>
                    <td>{record.namHoc}</td>
                    <td>
                      {record.monHocs.some(
                        (subject) => (subject.giangViens?.length ?? 0) > 0,
                      )
                        ? record.monHocs
                            .map((subject) => {
                              const teachers = subject.giangViens ?? [];
                              return teachers
                                .map(
                                  (teacher) =>
                                    `${subject.maMonHoc}: ${teacher.hoTen} (${teacher.vaiTro})`,
                                )
                                .join(", ");
                            })
                            .filter(Boolean)
                            .join("; ")
                        : record.giangVienTen ?? "Chưa phân công"}
                      {record.canBanGiao && (
                        <span className="academic-handover-warning">
                          Cần bàn giao
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>
                        {record.siSoHienTai}/{record.siSoToiDa}
                      </strong>
                      {record.canhBaoSiSo && (
                        <small className="class-capacity-warning">
                          Vượt sĩ số lớp
                        </small>
                      )}
                      {record.canhBaoSucChuaPhong && (
                        <small className="class-capacity-warning">
                          Vượt sức chứa phòng
                        </small>
                      )}
                      <details className="class-student-roster">
                        <summary>Hồ sơ học viên</summary>
                        {record.hocViens.length ? (
                          record.hocViens.map((student) => (
                            <div key={student.nguoiDungId}>
                              <button
                                className="class-student-profile-link"
                                type="button"
                                onClick={() =>
                                  void loadStudentProfile(student.nguoiDungId)
                                }
                              >
                                {student.hoTen}
                              </button>
                              <small>
                                Ghi danh{" "}
                                {new Date(student.ngayGhiDanh).toLocaleDateString(
                                  "vi-VN",
                                )}
                                {student.nguoiGhiDanh
                                  ? ` · ${student.nguoiGhiDanh}`
                                  : ""}
                              </small>
                            </div>
                          ))
                        ) : (
                          <small>Chưa có học viên.</small>
                        )}
                      </details>
                    </td>
                    <td>
                      {record.monHocs.length
                        ? record.monHocs
                            .map((subject) => subject.tenMonHoc)
                            .join(", ")
                        : "Chưa gán môn"}
                    </td>
                    <td>
                      <progress max={100} value={record.tienDo} />
                      <small>{record.tienDo}% · {record.ngayKhaiGiang}</small>
                      <small>
                        {record.hinhThuc}
                        {record.maPhong ? ` · ${record.maPhong}` : ""}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`academic-status ${
                          ["Chuẩn bị", "Đang học", "Đang hoạt động"].includes(
                            record.trangThai,
                          )
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {record.trangThai}
                      </span>
                    </td>
                    {canManageRows && (
                      <td className="academic-row-actions">
                        {["Chuẩn bị", "Đang học", "Đang hoạt động"].includes(
                          record.trangThai,
                        ) && (
                          <button
                            ref={
                              classActionsMenu?.classId === record.lopHocId
                                ? classActionsTriggerRef
                                : null
                            }
                            type="button"
                            className="academic-secondary-button class-actions-trigger"
                            aria-haspopup="menu"
                            aria-expanded={
                              classActionsMenu?.classId === record.lopHocId
                            }
                            aria-controls={`class-actions-menu-${record.lopHocId}`}
                            onClick={(event) =>
                              toggleClassActions(event, record)
                            }
                          >
                            Tác vụ <span aria-hidden="true">▾</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!listOnly &&
        canCreateSubjects &&
        isSubjectFormOpen &&
        createPortal(
          <div
            className="academic-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSubjectForm();
            }}
          >
            <form
              className="academic-modal subject-entry-modal"
              onSubmit={saveSubject}
            >
              <div className="academic-modal-heading">
                <div>
                  <h3>Thêm môn học</h3>
                  <p>Môn học mới sẽ xuất hiện trong danh sách để gán vào lớp.</p>
                </div>
                <button
                  type="button"
                  className="academic-modal-close"
                  onClick={closeSubjectForm}
                  disabled={saving}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
              {errorMessage && (
                <div
                  className="academic-alert academic-alert-error"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
              <div className="academic-form-grid">
                <label>
                  Mã môn
                  <input
                    required
                    maxLength={30}
                    value={subjectForm.maMonHoc}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        maMonHoc: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Tên môn học
                  <input
                    required
                    maxLength={150}
                    value={subjectForm.tenMonHoc}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        tenMonHoc: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Số tín chỉ
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={subjectForm.soTinChi}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        soTinChi: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Số buổi học
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={subjectForm.soBuoi}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        soBuoi: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Trọng số (0-1)
                  <input
                    required
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={subjectForm.trongSo}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        trongSo: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="subject-entry-wide-field">
                  Mô tả chuẩn đầu ra
                  <textarea
                    maxLength={2000}
                    value={subjectForm.moTaChuanDauRa}
                    onChange={(event) =>
                      setSubjectForm((current) => ({
                        ...current,
                        moTaChuanDauRa: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="academic-form-actions">
                <button
                  className="academic-secondary-button"
                  type="button"
                  onClick={closeSubjectForm}
                  disabled={saving}
                >
                  Hủy
                </button>
                <button
                  className="academic-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Đang thêm..." : "Thêm môn học"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </section>
  );
};

export default ClassManagement;
