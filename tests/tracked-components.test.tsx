// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrackedLink } from "@/components/common/TrackedLink";
import { TrackView } from "@/components/common/TrackView";

/**
 * The two components had no tests at all, so their three load-bearing
 * promises — "never cancels a navigation", "fires once under StrictMode",
 * "counts middle-clicks" — existed only as comments. The StrictMode one
 * matters most: without the guard every product_view would be reported
 * twice, and a doubled number in a dashboard looks exactly like traffic.
 */
const beacons: Array<{ url: string; body: unknown }> = [];

async function payloads() {
  return Promise.all(
    beacons.map(async (b) =>
      JSON.parse(b.body instanceof Blob ? await b.body.text() : String(b.body)),
    ),
  );
}

/** testing-library has no auxClick helper; dispatch the real event. */
function auxClick(element: HTMLElement, button: number) {
  act(() => {
    element.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button }));
  });
}

beforeEach(() => {
  beacons.length = 0;
  window.sessionStorage.clear();
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, body: unknown) => {
      beacons.push({ url, body });
      return true;
    },
  });
  process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED = "1";
  window.history.replaceState({}, "", "/tr/projects/lifeos");
});

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
});

describe("TrackView", () => {
  it("reports exactly once under StrictMode's double mount", async () => {
    render(
      <StrictMode>
        <TrackView event="product_view" product="lifeos" />
      </StrictMode>,
    );
    expect(beacons).toHaveLength(1);
    expect((await payloads())[0].event).toBe("product_view");
  });

  it("stays silent when attribution is off", () => {
    delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
    render(<TrackView event="product_view" product="lifeos" />);
    expect(beacons).toHaveLength(0);
  });
});

describe("TrackedLink", () => {
  it("never cancels the navigation", () => {
    render(
      <TrackedLink href="https://apps.apple.com/app/id6771527233" event="store_outbound" product="lifeos">
        Open
      </TrackedLink>,
    );
    // fireEvent.click returns false only if a handler called preventDefault.
    const notCancelled = fireEvent.click(screen.getByText("Open"));
    expect(notCancelled, "a handler cancelled the click").toBe(true);
    expect(beacons).toHaveLength(1);
  });

  it("still reports on a middle-click", async () => {
    render(
      <TrackedLink href="https://apps.apple.com/app/id6771527233" event="store_outbound" product="lifeos">
        Open
      </TrackedLink>,
    );
    auxClick(screen.getByText("Open"), 1);
    expect(beacons).toHaveLength(1);
    expect((await payloads())[0].target).toBe("https://apps.apple.com/app/id6771527233");
  });

  it("ignores a right-click", () => {
    render(
      <TrackedLink href="https://apps.apple.com/app/id6771527233" event="store_outbound" product="lifeos">
        Open
      </TrackedLink>,
    );
    auxClick(screen.getByText("Open"), 2);
    expect(beacons).toHaveLength(0);
  });

  it("sends no target for an in-page anchor", async () => {
    render(
      <TrackedLink href="#projeler" event="home_primary_cta">
        See products
      </TrackedLink>,
    );
    fireEvent.click(screen.getByText("See products"));
    const [payload] = await payloads();
    expect(payload.target).toBeUndefined();
    expect(payload.targetCategory).toBeUndefined();
  });

  it("classifies a store destination as store, not web", async () => {
    render(
      <TrackedLink href="https://apps.apple.com/app/id6771527233" event="store_outbound" product="lifeos">
        Open
      </TrackedLink>,
    );
    fireEvent.click(screen.getByText("Open"));
    expect((await payloads())[0].targetCategory).toBe("store");
  });

  it("still calls a caller-supplied onClick", () => {
    let called = false;
    render(
      <TrackedLink
        href="https://apps.apple.com/app/id6771527233"
        event="store_outbound"
        onClick={() => {
          called = true;
        }}
      >
        Open
      </TrackedLink>,
    );
    fireEvent.click(screen.getByText("Open"));
    expect(called).toBe(true);
  });
});
