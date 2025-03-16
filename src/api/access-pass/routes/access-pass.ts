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
  ],
};
