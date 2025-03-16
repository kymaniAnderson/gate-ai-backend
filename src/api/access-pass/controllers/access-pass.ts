/**
 * access-pass controller
 */

import { factories } from "@strapi/strapi";
import QRCode from "qrcode";

const generatePin = () => {
  // Generate a 6-digit PIN
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateQRCode = async (accessCode: string): Promise<string> => {
  try {
    // Generate QR code with just the access code
    // Configure QR code for optimal scanning
    const qrOptions = {
      errorCorrectionLevel: "Q", // Higher error correction for better scanning
      margin: 2, // Smaller margin for cleaner look
      width: 200, // Consistent size
      color: {
        dark: "#000000", // Black dots
        light: "#FFFFFF", // White background
      },
    };

    // Just encode the access code - simpler is better for scanning
    return await QRCode.toDataURL(accessCode, qrOptions);
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

const formatAccessPassResponse = (pass: any) => {
  // Helper to format the response according to frontend needs
  const response: any = {
    id: pass.id,
    visitorName: pass.visitorName,
    location: pass.resident?.units?.[0]?.name || "Unknown Location", // Assuming resident has units
    name: pass.visitorName,
    pin: pass.accessCode,
    qrCode: pass.qrCode,
    status: pass.status,
    createdAt: pass.createdAt,
    accessType: pass.accessType,
  };

  // Add time-bound specific fields
  if (pass.accessType === "time-bound") {
    response.validFrom = pass.date;
    response.validTimeFrom = pass.timeFrom;
    response.validTimeTo = pass.timeTo;
  }

  // Add date-range specific fields
  if (pass.accessType === "date-range") {
    response.validFrom = pass.dateFrom;
    response.validTo = pass.dateTo;
  }

  // Add usage-limit specific fields
  if (pass.accessType === "usage-limit") {
    response.usageLimit = pass.usageLimit;
    response.usageCount = pass.usageCount;
  }

  return response;
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

    async getByCode(ctx) {
      const { code } = ctx.params;

      try {
        // Find the access pass by code
        const pass = await strapi.db
          .query("api::access-pass.access-pass")
          .findOne({
            where: { accessCode: code },
            populate: {
              resident: {
                populate: {
                  units: true,
                },
              },
            },
          });

        if (!pass) {
          return ctx.notFound("Access pass not found");
        }

        // Check if pass is expired
        const now = new Date();
        let isExpired = false;

        switch (pass.accessType) {
          case "time-bound":
            const passDate = new Date(pass.date);
            const [hours, minutes] = pass.timeTo.split(":");
            passDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            isExpired = now > passDate;
            break;

          case "date-range":
            const endDate = new Date(pass.dateTo);
            endDate.setHours(23, 59, 59);
            isExpired = now > endDate;
            break;

          case "usage-limit":
            isExpired = pass.usageCount >= pass.usageLimit;
            break;
        }

        // Update status if expired
        if (isExpired && pass.status === "active") {
          await strapi.db.query("api::access-pass.access-pass").update({
            where: { id: pass.id },
            data: { status: "expired" },
          });
          pass.status = "expired";
        }

        return formatAccessPassResponse(pass);
      } catch (error) {
        console.error("Error fetching access pass:", error);
        return ctx.badRequest("Failed to fetch access pass");
      }
    },

    async getMyPasses(ctx) {
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized(
          "You must be logged in to view your access passes"
        );
      }

      try {
        const passes = await strapi.db
          .query("api::access-pass.access-pass")
          .findMany({
            where: { resident: user.id },
            populate: {
              resident: {
                populate: {
                  units: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });

        // Check and update status for each pass
        const updatedPasses = await Promise.all(
          passes.map(async (pass) => {
            const now = new Date();
            let isExpired = false;

            switch (pass.accessType) {
              case "time-bound":
                const passDate = new Date(pass.date);
                const [hours, minutes] = pass.timeTo.split(":");
                passDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                isExpired = now > passDate;
                break;

              case "date-range":
                const endDate = new Date(pass.dateTo);
                endDate.setHours(23, 59, 59);
                isExpired = now > endDate;
                break;

              case "usage-limit":
                isExpired = pass.usageCount >= pass.usageLimit;
                break;
            }

            // Update status if expired
            if (isExpired && pass.status === "active") {
              const updatedPass = await strapi.db
                .query("api::access-pass.access-pass")
                .update({
                  where: { id: pass.id },
                  data: { status: "expired" },
                });
              return formatAccessPassResponse(updatedPass);
            }

            return formatAccessPassResponse(pass);
          })
        );

        // Group passes by status
        const groupedPasses = {
          active: updatedPasses.filter((pass) => pass.status === "active"),
          expired: updatedPasses.filter((pass) => pass.status === "expired"),
          cancelled: updatedPasses.filter(
            (pass) => pass.status === "cancelled"
          ),
        };

        return groupedPasses;
      } catch (error) {
        console.error("Error fetching access passes:", error);
        return ctx.badRequest("Failed to fetch access passes");
      }
    },

    async cancelPass(ctx) {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized(
          "You must be logged in to cancel an access pass"
        );
      }

      try {
        // Find the pass and check ownership
        const pass = await strapi.db
          .query("api::access-pass.access-pass")
          .findOne({
            where: { id },
            populate: { resident: true },
          });

        if (!pass) {
          return ctx.notFound("Access pass not found");
        }

        if (pass.resident.id !== user.id) {
          return ctx.forbidden("You can only cancel your own access passes");
        }

        // Update the pass status to cancelled
        const updatedPass = await strapi.db
          .query("api::access-pass.access-pass")
          .update({
            where: { id },
            data: { status: "cancelled" },
          });

        return formatAccessPassResponse(updatedPass);
      } catch (error) {
        console.error("Error cancelling access pass:", error);
        return ctx.badRequest("Failed to cancel access pass");
      }
    },
  })
);
