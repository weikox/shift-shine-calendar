/**
 * Generates a simulated purchase receipt as a PNG blob using Canvas API.
 */

interface TicketData {
  name: string;
  amount: number;
  date: string;
  account: string;
  location?: { latitude: number; longitude: number } | null;
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

export const generateAutoTicket = async (data: TicketData): Promise<File> => {
  const canvas = document.createElement("canvas");
  const width = 400;
  const height = 520;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Dashed border
  ctx.strokeStyle = "#CCCCCC";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(10, 10, width - 20, height - 20);
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
    // Wrap long values
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

    ctx.font = "12px monospace";
    ctx.fillStyle = "#555555";
    ctx.fillText(`Lat: ${data.location.latitude.toFixed(6)}`, labelX + 10, y);
    y += lineHeight * 0.7;
    ctx.fillText(`Lon: ${data.location.longitude.toFixed(6)}`, labelX + 10, y);
    y += lineHeight * 0.7;

    // Approximate address via coords
    const mapsUrl = `maps.google.com/?q=${data.location.latitude},${data.location.longitude}`;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#888888";
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

  // Convert to file
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });

  const fileName = `auto_ticket_${Date.now()}.png`;
  return new File([blob], fileName, { type: "image/png" });
};
