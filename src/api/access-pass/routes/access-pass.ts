/**
 * access-pass router
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/access-passes",
      handler: "access-pass.create",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/access-passes/code/:code",
      handler: "access-pass.getByCode",
      config: {
        auth: false, // Make this endpoint public
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/access-passes/my-passes",
      handler: "access-pass.getMyPasses",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/access-passes/:id/cancel",
      handler: "access-pass.cancelPass",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
