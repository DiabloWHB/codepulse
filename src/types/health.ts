/**
 * Health status of a code element.
 */
export enum HealthStatus {
  /** No issues detected */
  HEALTHY = 'healthy',
  /** Potential issues that may cause problems */
  WARNING = 'warning',
  /** Definite issues that will cause failures */
  ERROR = 'error',
  /** Unable to determine health */
  UNKNOWN = 'unknown'
}

/**
 * Severity levels for issues.
 * Maps to VS Code DiagnosticSeverity.
 */
export enum IssueSeverity {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  HINT = 3
}

/**
 * Categories of issues for grouping and filtering.
 */
export enum IssueCategory {
  SYNTAX = 'syntax',
  TYPE = 'type',
  IMPORT = 'import',
  API = 'api',
  DATABASE = 'database',
  ENVIRONMENT = 'environment',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

/**
 * Get icon for health status.
 */
export function getHealthIcon(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return '🟢';
    case HealthStatus.WARNING:
      return '🟡';
    case HealthStatus.ERROR:
      return '🔴';
    case HealthStatus.UNKNOWN:
      return '⚪';
  }
}

/**
 * Get display name for health status.
 */
export function getHealthDisplayName(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return 'Healthy';
    case HealthStatus.WARNING:
      return 'Warning';
    case HealthStatus.ERROR:
      return 'Error';
    case HealthStatus.UNKNOWN:
      return 'Unknown';
  }
}
