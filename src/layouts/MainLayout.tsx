import React from "react";
import AdminLayout from "./AdminLayout";

interface MainLayoutProps {
  children: React.ReactNode;

  userName: string;
  roleName: string;
  avatarUrl?: string | null;
  permissions: string[];
  isStudent?: boolean;

  onLogout: () => void;

  // =========================================================
  // ĐIỀU HƯỚNG
  // =========================================================

  onHome: () => void;
  onGradeManagement: () => void;
  onStudentInformation: () => void;
  onClassHistory: () => void;
  onClassManagement: () => void;
  onTrainingCatalog: () => void;
  onTrainingPrograms?: () => void;
  onAdmissionsLeads: () => void;
  onScheduleManagement?: () => void;
  onClassAttendanceManagement?: () => void;
  onAssignments?: () => void;
  onAbsenceRequest?: () => void;
  onAbsenceRequestList?: () => void;
  onProfile: () => void;
  onChangePassword: () => void;

}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName,
  roleName,
  avatarUrl,
  permissions,
  isStudent = false,
  onLogout,

  onHome,
  onGradeManagement,
  onStudentInformation,
  onClassHistory,
  onClassManagement,
  onTrainingCatalog,
  onTrainingPrograms = () => {},
  onAdmissionsLeads,
  onScheduleManagement = () => window.location.assign("/quan-ly-lich-hoc"),
  onAssignments = () => window.location.assign("/quan-ly-bai-tap"),
  onAbsenceRequest = () => window.location.assign("/don-xin-phep"),
  onAbsenceRequestList = () =>
    window.location.assign("/don-xin-phep/theo-doi"),
  onProfile,
  onChangePassword,

}) => {
  return (
    <AdminLayout
      userName={userName}
      roleName={roleName}
      avatarUrl={avatarUrl}
      isAdmin={false}
      isStudent={isStudent}
      permissions={permissions}
      onLogout={onLogout}
      onRoleManagement={() => window.location.assign("/phan-quyen")}
      onHome={onHome}
      onUserManagement={() => window.location.assign("/quan-ly-nguoi-dung")}
      onGradeManagement={onGradeManagement}
      onStudentInformation={onStudentInformation}
      onClassHistory={onClassHistory}
      onClassManagement={onClassManagement}
      onTrainingCatalog={onTrainingCatalog}
      onTrainingPrograms={onTrainingPrograms}
      onAdmissionsLeads={onAdmissionsLeads}
      onScheduleManagement={onScheduleManagement}
      onAssignments={onAssignments}
      onAbsenceRequest={onAbsenceRequest}
      onAbsenceRequestList={onAbsenceRequestList}
      onChangePassword={onChangePassword}
      onProfile={onProfile}
    >
      {children}
    </AdminLayout>
  );
};

export default MainLayout;
