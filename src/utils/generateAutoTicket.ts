/**
 * Generates a simulated purchase receipt as a PNG blob using Canvas API.
 */

interface TicketData {
  name: string;
  amount: number;
  date: string;
  account: string;
  location?: { latitude: number; longitude: number } | null;
  address?: AddressInfo | null;
}

export interface AddressInfo {
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  displayName?: string;
}

export const getDeviceLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
};

export const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<AddressInfo | null> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=es`,
      { headers: { "User-Agent": "AutoTicketApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    return {
      street: addr.road || addr.pedestrian || addr.footway || undefined,
      houseNumber: addr.house_number || undefined,
      city: addr.city || addr.town || addr.village || addr.municipality || undefined,
      state: addr.state || undefined,
      postcode: addr.postcode || undefined,
      country: addr.country || undefined,
      displayName: data.display_name || undefined,
    };
  } catch {
    return null;
  }
};

export const generateAutoTicket = async (data: TicketData): Promise<File> => {
  const canvas = document.createElement("canvas");
  const width = 400;
  // Dynamic height based on content
  let estimatedHeight = 520;
  if (data.location && data.address) estimatedHeight = 680;
  else if (data.location) estimatedHeight = 560;
  canvas.width = width;
  canvas.height = estimatedHeight;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Dashed border
  ctx.strokeStyle = "#CCCCCC";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(10, 10, width - 20, estimatedHeight - 20);
  ctx.setLineDash([]);

  // Header
  ctx.fillStyle = "#333333";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("AUTO TICKET", width / 2, 50);

  ctx.font = "12px monospace";
  ctx.fillStyle = "#888888";
  ctx.fillText("Documento generado automáticamente", width / 2, 70);

  // Separator
  const drawSeparator = (y: number) => {
    ctx.strokeStyle = "#DDDDDD";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width - 30, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawSeparator(85);

  // Content
  ctx.textAlign = "left";
  ctx.fillStyle = "#333333";
  let y = 110;
  const lineHeight = 28;
  const labelX = 40;
  const valueX = 160;

  const drawField = (label: string, value: string) => {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#666666";
    ctx.fillText(label, labelX, y);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#333333";
    const maxWidth = width - valueX - 40;
    const words = value.split(" ");
    let line = "";
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, valueX, y);
        y += lineHeight * 0.7;
        line = word;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, valueX, y);
    y += lineHeight;
  };

  const drawSmallField = (label: string, value: string) => {
    ctx.font = "11px monospace";
    ctx.fillStyle = "#777777";
    ctx.fillText(label, labelX + 10, y);
    ctx.fillStyle = "#444444";
    const maxWidth = width - labelX - 80;
    const labelWidth = ctx.measureText(label + " ").width;
    const startX = labelX + 10 + labelWidth;
    const words = value.split(" ");
    let line = "";
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, startX, y);
        y += lineHeight * 0.6;
        line = word;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, startX, y);
    y += lineHeight * 0.7;
  };

  drawField("Concepto:", data.name || "Sin nombre");
  drawField("Importe:", `${data.amount.toFixed(2)} €`);
  drawField("Fecha:", data.date);
  drawField("Cuenta:", data.account);

  drawSeparator(y + 5);
  y += 30;

  if (data.location) {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#666666";
    ctx.fillText("Ubicación:", labelX, y);
    y += lineHeight * 0.8;

    // Address details
    if (data.address) {
      const addr = data.address;
      const streetLine = [addr.street, addr.houseNumber].filter(Boolean).join(" ");
      if (streetLine) drawSmallField("Calle:", streetLine);
      if (addr.postcode || addr.city) {
        const cityLine = [addr.postcode, addr.city].filter(Boolean).join(" ");
        drawSmallField("Ciudad:", cityLine);
      }
      if (addr.state) drawSmallField("Provincia:", addr.state);
      if (addr.country) drawSmallField("País:", addr.country);
      y += 4;
    }

    ctx.font = "11px monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Lat: ${data.location.latitude.toFixed(6)}  Lon: ${data.location.longitude.toFixed(6)}`, labelX + 10, y);
    y += lineHeight * 0.7;

    const mapsUrl = `maps.google.com/?q=${data.location.latitude},${data.location.longitude}`;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#AAAAAA";
    ctx.fillText(mapsUrl, labelX + 10, y);
    y += lineHeight;
  } else {
    ctx.font = "12px monospace";
    ctx.fillStyle = "#999999";
    ctx.fillText("Ubicación no disponible", labelX, y);
    y += lineHeight;
  }

  drawSeparator(y + 5);
  y += 30;

  // Timestamp
  ctx.font = "10px monospace";
  ctx.fillStyle = "#AAAAAA";
  ctx.textAlign = "center";
  const now = new Date();
  ctx.fillText(
    `Generado: ${now.toLocaleDateString("es-ES")} ${now.toLocaleTimeString("es-ES")}`,
    width / 2,
    y
  );

  // Resize canvas to actual content height
  const finalHeight = y + 30;
  if (finalHeight !== estimatedHeight) {
    const imageData = ctx.getImageData(0, 0, width, Math.min(finalHeight, estimatedHeight));
    canvas.height = finalHeight;
    ctx.putImageData(imageData, 0, 0);
    // Redraw border
    ctx.strokeStyle = "#CCCCCC";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(10, 10, width - 20, finalHeight - 20);
    ctx.setLineDash([]);
  }

  // Convert to file
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });

  const fileName = `auto_ticket_${Date.now()}.png`;
  return new File([blob], fileName, { type: "image/png" });
};
