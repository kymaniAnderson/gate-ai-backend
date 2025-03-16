/**
 * incident-report controller
 */

import { factories } from "@strapi/strapi";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateReport = async (
  accessLogs: any[],
  date: string,
  timeFrom: string,
  timeTo: string
) => {
  const prompt = `Generate a detailed security incident report based on the following access log data for ${date} between ${timeFrom} and ${timeTo}. 
  
Access Logs:
${JSON.stringify(accessLogs, null, 2)}

Please include:
1. Executive Summary
2. Timeline of Events
3. Visitor Activity Analysis
4. Areas Accessed
5. Any Notable Patterns or Concerns
6. Recommendations (if any)

Format the report in a professional manner suitable for security documentation.`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      max_tokens: 2000,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate report");
  }
};

export default factories.createCoreController(
  "api::incident-report.incident-report",
  ({ strapi }) => ({
    async generate(ctx) {
      const { date, timeFrom, timeTo } = ctx.request.body;

      // Validate required fields
      if (!date || !timeFrom || !timeTo) {
        return ctx.badRequest("Date, timeFrom, and timeTo are required");
      }

      try {
        // Convert times to handle date comparison
        const startDateTime = new Date(`${date}T${timeFrom}`);
        const endDateTime = new Date(`${date}T${timeTo}`);

        // Get all access passes that were active during the specified time period
        const accessPasses = await strapi.db
          .query("api::access-pass.access-pass")
          .findMany({
            where: {
              $or: [
                // Time-bound passes for the specific date
                {
                  accessType: "time-bound",
                  date,
                  status: "active",
                },
                // Date-range passes that include the specified date
                {
                  accessType: "date-range",
                  dateFrom: { $lte: date },
                  dateTo: { $gte: date },
                  status: "active",
                },
                // Usage-limit passes that were active
                {
                  accessType: "usage-limit",
                  status: "active",
                  createdAt: { $lte: endDateTime },
                },
              ],
            },
            populate: {
              resident: {
                populate: ["units"],
              },
            },
          });

        // Filter passes based on time for time-bound passes
        const relevantPasses = accessPasses.filter((pass) => {
          if (pass.accessType === "time-bound") {
            const passStartTime = new Date(`${date}T${pass.timeFrom}`);
            const passEndTime = new Date(`${date}T${pass.timeTo}`);
            return passStartTime <= endDateTime && passEndTime >= startDateTime;
          }
          return true;
        });

        // Format access logs for the report
        const accessLogs = relevantPasses.map((pass) => ({
          visitorName: pass.visitorName,
          accessType: pass.accessType,
          location: pass.resident?.units?.[0]?.name || "Unknown Location",
          residentName: pass.resident?.name || "Unknown Resident",
          timeDetails:
            pass.accessType === "time-bound"
              ? { from: pass.timeFrom, to: pass.timeTo }
              : pass.accessType === "date-range"
                ? { from: pass.dateFrom, to: pass.dateTo }
                : { usageCount: pass.usageCount, limit: pass.usageLimit },
          status: pass.status,
        }));

        // Generate report using OpenAI
        const report = await generateReport(accessLogs, date, timeFrom, timeTo);

        // Save the report
        const savedReport = await strapi.entityService.create(
          "api::incident-report.incident-report",
          {
            data: {
              date,
              timeFrom,
              timeTo,
              report,
              accessLogs: accessLogs,
            },
          }
        );

        return {
          id: savedReport.id,
          date,
          timeFrom,
          timeTo,
          report,
          accessLogs,
        };
      } catch (error) {
        console.error("Error generating incident report:", error);
        return ctx.badRequest("Failed to generate incident report");
      }
    },
  })
);
