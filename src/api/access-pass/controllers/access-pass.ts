/**
 * access-pass controller
 */

import { factories } from "@strapi/strapi";
import QRCode from "qrcode";

const generatePin = () => {
  // Generate a 6-digit PIN
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateQRCode = async (data: string): Promise<string> => {
  try {
    // Generate QR code as base64
    return await QRCode.toDataURL(data);
  } catch (err) {
    console.error("Error generating QR code:", err);
    throw err;
  }
};

const validateTimeFormat = (time: string): boolean => {
  // Validate time format (HH:mm)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

const validateDateFormat = (date: string): boolean => {
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date);
};

export default factories.createCoreController(
  "api::access-pass.access-pass",
  ({ strapi }) => ({
    async create(ctx) {
      const { user } = ctx.state; // Get authenticated user
      const data = ctx.request.body;

      // Validate required fields
      if (!data.visitorName || !data.accessType || !data.accessMethod) {
        return ctx.badRequest("Missing required fields");
      }

      // Validate access type specific fields
      switch (data.accessType) {
        case "time-bound":
          if (!data.date || !data.timeFrom || !data.timeTo) {
            return ctx.badRequest("Missing time-bound access details");
          }
          if (!validateDateFormat(data.date)) {
            return ctx.badRequest("Invalid date format. Use YYYY-MM-DD");
          }
          if (
            !validateTimeFormat(data.timeFrom) ||
            !validateTimeFormat(data.timeTo)
          ) {
            return ctx.badRequest("Invalid time format. Use HH:mm");
          }
          break;

        case "date-range":
          if (!data.dateFrom || !data.dateTo) {
            return ctx.badRequest("Missing date range access details");
          }
          if (
            !validateDateFormat(data.dateFrom) ||
            !validateDateFormat(data.dateTo)
          ) {
            return ctx.badRequest("Invalid date format. Use YYYY-MM-DD");
          }
          break;

        case "usage-limit":
          if (!data.usageLimit || data.usageLimit < 1) {
            return ctx.badRequest("Invalid usage limit");
          }
          break;
      }

      try {
        // Generate access code (PIN)
        const accessCode = generatePin();

        // Generate QR code if needed
        let qrCode = null;
        if (data.accessMethod === "qr-pin") {
          qrCode = await generateQRCode(accessCode);
        }

        // Create the access pass
        const accessPass = await strapi.entityService.create(
          "api::access-pass.access-pass",
          {
            data: {
              visitorName: data.visitorName,
              accessType: data.accessType,
              date: data.date,
              timeFrom: data.timeFrom,
              timeTo: data.timeTo,
              dateFrom: data.dateFrom,
              dateTo: data.dateTo,
              usageLimit: data.usageLimit,
              usageCount: 0,
              accessMethod: data.accessMethod,
              notifications: data.notifications || false,
              accessCode,
              qrCode,
              status: "active",
              resident: user.id,
            },
          }
        );

        // Return the response
        return {
          id: accessPass.id,
          visitorName: accessPass.visitorName,
          accessCode: accessPass.accessCode,
          qrCode: accessPass.qrCode,
          status: accessPass.status,
          createdAt: accessPass.createdAt,
          accessType: accessPass.accessType,
          date: accessPass.date,
          timeFrom: accessPass.timeFrom,
          timeTo: accessPass.timeTo,
          dateFrom: accessPass.dateFrom,
          dateTo: accessPass.dateTo,
          usageLimit: accessPass.usageLimit,
          accessMethod: accessPass.accessMethod,
          notifications: accessPass.notifications,
        };
      } catch (error) {
        return ctx.badRequest("Failed to create access pass");
      }
    },
  })
);
