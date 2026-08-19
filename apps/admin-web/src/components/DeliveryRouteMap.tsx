import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import type { OrderRoute } from "@/lib/api";

// Leaflet-ийн анхдагч marker icon зам bundler (Vite)-той зөв ажиллахгүй
// (webpack/CRA-д зориулсан харьцангуй зам таамагладаг) тул зургуудыг
// шууд import хийж дахин тохируулах нь нийтлэг шийдэл (leaflet-ийн GitHub
// issue-нүүдэд өргөн танигдсан workaround).
const markerIconDefault = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface DeliveryRouteMapProps {
  branchLat: number;
  branchLng: number;
  deliveryLat: number;
  deliveryLng: number;
  route?: OrderRoute;
}

// apps/api/src/routing/routing-provider.interface.ts-ийн тайлбарын дагуу
// backend-ийн geometry [lng, lat] дараалалтай (GeoJSON/OSRM стандарт) —
// Leaflet бол ЭСРЭГЭЭР [lat, lng] хүлээдэг тул зурахдаа ЗААВАЛ эргүүлж
// хөрвүүлнэ.
function toLeafletLatLngs(geometry: [number, number][]): [number, number][] {
  return geometry.map(([lng, lat]) => [lat, lng]);
}

// docs/plan.md §8 Phase 4, Хэсэг A #6: Order дэлгэрэнгүй дэлгэц дээр
// (DELIVERY захиалганд л) OSM tile + 2 marker (салбар, хүргэх цэг) +
// GET /orders/:id/route-ийн geometry-г шугам болгож зурна. Checkout
// координат сонгогч UI (admin-web-д захиалга ҮҮСГЭХ дэлгэц угаасаа
// байхгүй, харилцагчийн UI Mobile-д — өмнөх бүх Phase-ийн тогтсон
// зарчим) энэ компонентод ОРООГҮЙ, зөвхөн READ-only харагдац.
export function DeliveryRouteMap({
  branchLat,
  branchLng,
  deliveryLat,
  deliveryLng,
  route,
}: DeliveryRouteMapProps) {
  const center: [number, number] = [
    (branchLat + deliveryLat) / 2,
    (branchLng + deliveryLng) / 2,
  ];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: 320, width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> хувь нэмэр оруулагчид'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[branchLat, branchLng]} icon={markerIconDefault} />
      <Marker position={[deliveryLat, deliveryLng]} icon={markerIconDefault} />
      {route && <Polyline positions={toLeafletLatLngs(route.geometry)} />}
    </MapContainer>
  );
}
