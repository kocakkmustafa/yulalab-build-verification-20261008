"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type ExperienceErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ExperienceErrorBoundaryState = {
  hasError: boolean;
};

export class ExperienceErrorBoundary extends Component<
  ExperienceErrorBoundaryProps,
  ExperienceErrorBoundaryState
> {
  state: ExperienceErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ExperienceErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default ExperienceErrorBoundary;
