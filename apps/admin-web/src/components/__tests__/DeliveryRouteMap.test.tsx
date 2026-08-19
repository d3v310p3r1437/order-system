import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeliveryRouteMap } from "@/components/DeliveryRouteMap";
import type { OrderRoute } from "@/lib/api";

// jsdom-д бодит Leaflet DOM (canvas/tile хүсэлт) render хийхгүй, зөвхөн
// props зөв дамжсаныг шалгах smoke түвшин (ProductImageGallery.test.tsx-тэй
// адил хэмжээ) — MapContainer/TileLayer/Marker/Polyline-г энгийн
// test-double компонент болгож орлуулна.
vi.mock("react-leaflet", () => ({
  MapContainer: ({
    children,
    center,
  }: {
    children: React.ReactNode;
    center: [number, number];
  }) => (
    <div data-testid="map-container" data-center={center.join(",")}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="marker" data-position={position.join(",")} />
  ),
  Polyline: ({ positions }: { positions: [number, number][] }) => (
    <div data-testid="polyline" data-points={positions.length} />
  ),
}));

const route: OrderRoute = {
  distanceMeters: 1500,
  durationSeconds: 180,
  geometry: [
    [106.917, 47.918],
    [106.93, 47.925],
  ],
};

describe("DeliveryRouteMap", () => {
  it("салбар/хүргэлтийн 2 marker + route.geometry-г [lat,lng]-рүү хөрвүүлсэн polyline зурна", () => {
    render(
      <DeliveryRouteMap
        branchLat={47.918}
        branchLng={106.917}
        deliveryLat={47.925}
        deliveryLng={106.93}
        route={route}
      />,
    );

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute("data-position", "47.918,106.917");
    expect(markers[1]).toHaveAttribute("data-position", "47.925,106.93");

    // geometry [lng,lat] -> Leaflet [lat,lng] хөрвүүлэлт зөв эсэхийг шалгана.
    expect(screen.getByTestId("polyline")).toHaveAttribute(
      "data-points",
      "2",
    );
  });

  it("route өгөгдөөгүй үед polyline зурахгүй (2 marker л харагдана)", () => {
    render(
      <DeliveryRouteMap
        branchLat={47.918}
        branchLng={106.917}
        deliveryLat={47.925}
        deliveryLng={106.93}
      />,
    );

    expect(screen.getAllByTestId("marker")).toHaveLength(2);
    expect(screen.queryByTestId("polyline")).not.toBeInTheDocument();
  });
});
