// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

const navigation = vi.hoisted(() => ({
  locale: "tr", pathname: "/privacy/motion", replace: vi.fn(),
}));
vi.mock("next-intl", () => ({ useLocale: () => navigation.locale }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
afterEach(() => {
  cleanup();
  navigation.replace.mockClear();
  navigation.locale = "tr";
  window.history.replaceState({}, "", "/");
});

describe("LocaleSwitcher", () => {
  it.each(["tr", "en"])("keeps the account deletion section when leaving %s", (locale) => {
    navigation.locale = locale;
    window.history.replaceState({}, "", "/privacy/motion#motion-account-deletion");
    const onNavigate = vi.fn();
    render(<LocaleSwitcher onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /TR\/EN/ }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/privacy/motion#motion-account-deletion", { locale: locale === "tr" ? "en" : "tr" },
    );
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("does not propagate query values to a different locale", () => {
    window.history.replaceState({}, "", "/privacy/motion?email=private%40example.com#motion-account-deletion");
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /TR\/EN/ }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/privacy/motion#motion-account-deletion", { locale: "en" },
    );
  });
});
