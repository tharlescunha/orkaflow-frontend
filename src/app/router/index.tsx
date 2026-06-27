import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../../layouts/app-layout";
import { AuthLayout } from "../../layouts/auth-layout";
import { LoginPage } from "../../pages/auth/login-page";
import { DashboardPage } from "../../pages/dashboard/dashboard-page";
import { TasksPage } from "../../pages/tasks/tasks-page";
import { TaskDetailPage } from "../../pages/tasks/task-detail-page";
import { TaskCreatePage } from "../../pages/tasks/task-create-page";
import { TaskErrorsPage } from "../../pages/errors/task-errors-page";
import { TaskErrorDetailPage } from "../../pages/errors/task-error-detail-page";
import { RunnersPage } from "../../pages/runners/runners-page";
import { RunnerDetailPage } from "../../pages/runners/runner-detail-page";
import { RunnerConfigsPage } from "../../pages/runner-config/runner-configs-page";
import { RunnerConfigDetailPage } from "../../pages/runner-config/runner-config-detail-page";
import { RunnerConfigEditPage } from "../../pages/runner-config/runner-config-edit-page";
import { WorkerRegistrationPage } from "../../pages/runner-config/worker-registration-page";
import { ProfilePage } from "../../pages/profile/profile-page";
import { useAuthStore } from "../../store/auth-store";

import { BotDetailPage } from "../../pages/bots/bot-detail-page";
import { BotsPage } from "../../pages/bots/bots-page";
import { BotEditPage } from "../../pages/bots/bot-edit-page";
import { BotCreatePage } from "../../pages/bots/bot-create-page";

import { BotVersionsPage } from "../../pages/bot-versions/bot-versions-page";
import { BotVersionCreatePage } from "../../pages/bot-versions/bot-version-create-page";
import { BotVersionDetailPage } from "../../pages/bot-versions/bot-version-detail-page";

import { RepositoriesPage } from "../../pages/repositories/repositories-page";
import { RepositoryDetailPage } from "../../pages/repositories/repository-detail-page";
import { RepositoryFormPage } from "../../pages/repositories/repository-form-page";

import { AutomationsPage } from "../../pages/automations/automations-page";
import { AutomationDetailPage } from "../../pages/automations/automation-detail-page";
import { AutomationFormPage } from "../../pages/automations/automation-form-page";
import { AutomationHealthPage } from "../../pages/health/automation-health-page";

import { SchedulesPage } from "../../pages/schedules/schedules-page";
import { ScheduleDetailPage } from "../../pages/schedules/schedule-detail-page";
import { ScheduleFormPage } from "../../pages/schedules/schedule-form-page";

import { CredentialsPage } from "../../pages/credentials/credentials-page";
import { CredentialCreatePage } from "../../pages/credentials/credential-create-page";
import { CredentialDetailPage } from "../../pages/credentials/credential-detail-page";
import { CredentialEditPage } from "../../pages/credentials/credential-edit-page";

import { UsersPage } from "../../pages/users/users-page";
import { UserCreatePage } from "../../pages/users/user-create-page";
import { UserDetailPage } from "../../pages/users/user-detail-page";
import { UserEditPage } from "../../pages/users/user-edit-page";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore.getState().accessToken;
  return token ? children : <Navigate to="/login" replace />;
}

function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Tela em preparação.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/automations/health" replace /> },

      { path: "dashboard", element: <DashboardPage /> },

      { path: "tasks", element: <TasksPage /> },
      { path: "tasks/new", element: <TaskCreatePage /> },
      { path: "tasks/:taskId", element: <TaskDetailPage /> },

      { path: "runners", element: <RunnersPage /> },
      { path: "runners/:runnerId", element: <RunnerDetailPage /> },

      { path: "runner-configs", element: <RunnerConfigsPage /> },
      { path: "runner-configs/:runnerId", element: <RunnerConfigDetailPage /> },
      { path: "runner-configs/:runnerId/edit", element: <RunnerConfigEditPage /> },

      { path: "logs", element: <PagePlaceholder title="Logs" /> },
      { path: "errors", element: <TaskErrorsPage /> },
      { path: "errors/:errorId", element: <TaskErrorDetailPage /> },

      { path: "bots", element: <BotsPage /> },
      { path: "bots/new", element: <BotCreatePage /> },
      { path: "bots/:botId", element: <BotDetailPage /> },
      { path: "bots/:botId/edit", element: <BotEditPage /> },

      { path: "bot-versions", element: <BotVersionsPage /> },
      { path: "bot-versions/new", element: <BotVersionCreatePage /> },
      { path: "bot-versions/:botVersionId", element: <BotVersionDetailPage /> },

      { path: "repositories", element: <RepositoriesPage /> },
      { path: "repositories/new", element: <RepositoryFormPage /> },
      { path: "repositories/:repositoryId", element: <RepositoryDetailPage /> },
      { path: "repositories/:repositoryId/edit", element: <RepositoryFormPage /> },

      { path: "automations", element: <AutomationsPage /> },
      { path: "automations/health", element: <AutomationHealthPage /> },
      { path: "automations/new", element: <AutomationFormPage /> },
      { path: "automations/:automationId", element: <AutomationDetailPage /> },
      { path: "automations/:automationId/edit", element: <AutomationFormPage /> },

      { path: "schedules", element: <SchedulesPage /> },
      { path: "schedules/new", element: <ScheduleFormPage /> },
      { path: "schedules/:scheduleId", element: <ScheduleDetailPage /> },
      { path: "schedules/:scheduleId/edit", element: <ScheduleFormPage /> },

      { path: "credentials", element: <CredentialsPage /> },
      { path: "credentials/new", element: <CredentialCreatePage /> },
      { path: "credentials/:credentialId", element: <CredentialDetailPage /> },
      { path: "credentials/:credentialId/edit", element: <CredentialEditPage /> },

      { path: "users", element: <UsersPage /> },
      { path: "users/new", element: <UserCreatePage /> },
      { path: "users/:userId", element: <UserDetailPage /> },
      { path: "users/:userId/edit", element: <UserEditPage /> },

      { path: "worker-registration", element: <WorkerRegistrationPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
]);
