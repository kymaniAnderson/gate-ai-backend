/**
 * incident-report router
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/incident-reports/generate",
      handler: "incident-report.generate",
      config: {
        policies: ["admin::isAuthenticatedAdmin"], // Only admins can generate reports
      },
    },
  ],
};
