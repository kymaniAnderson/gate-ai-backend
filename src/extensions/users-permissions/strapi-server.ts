import crypto from "crypto";

export default (plugin: any) => {
  // Extend the auth controller to modify login response
  const authController = plugin.controllers.auth;
  const originalCallback = authController.callback;

  // Override the callback function (used for login)
  authController.callback = async (ctx: any) => {
    // Call the original callback to get the default response
    const response = await originalCallback(ctx);

    // If login was successful and we have a user
    if (response && response.user) {
      // Fetch the user with role information
      const populatedUser = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: response.user.id },
          populate: ["role"],
        });

      // Update the response with the populated user data
      response.user = {
        ...response.user,
        role: populatedUser.role,
      };
    }

    return response;
  };

  // Extend the user controller to modify /me response
  const userController = plugin.controllers.user;
  const originalGetMe = userController.me;

  // Override the me function
  userController.me = async (ctx: any) => {
    // Get authenticated user
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized();
    }

    // Fetch the user with role information
    const populatedUser = await strapi
      .query("plugin::users-permissions.user")
      .findOne({
        where: { id: user.id },
        populate: ["role"],
      });

    // Return the populated user data
    return {
      ...populatedUser,
      role: populatedUser.role,
    };
  };

  plugin.controllers.user.invite = async (ctx: any) => {
    const { email, role } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email is required");
    }

    if (!role) {
      return ctx.badRequest("Role is required");
    }

    try {
      // Check if user already exists
      const existingUser = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email },
        });

      if (existingUser) {
        return ctx.badRequest("User already exists");
      }

      // Get the role
      const roleEntity = await strapi
        .query("plugin::users-permissions.role")
        .findOne({
          where: { type: role },
        });

      if (!roleEntity) {
        return ctx.badRequest("Role does not exist");
      }

      // Generate a random password
      const password = crypto.randomBytes(16).toString("hex");

      // Create the user
      const user = await strapi.query("plugin::users-permissions.user").create({
        data: {
          email,
          password,
          role: roleEntity.id,
          confirmed: true,
          provider: "local",
        },
      });

      // Send invitation email
      try {
        await strapi.plugins["email"].services.email.send({
          to: email,
          subject: "Invitation to join",
          html: `
            <p>You have been invited to join our platform.</p>
            <p>Your login credentials:</p>
            <p>Email: ${email}</p>
            <p>Password: ${password}</p>
            <p>Please change your password after first login.</p>
          `,
        });

        return ctx.send({
          message: "Invitation sent successfully",
          user: {
            id: user.id,
            email: user.email,
          },
        });
      } catch (error) {
        // If email fails, delete the created user
        await strapi.query("plugin::users-permissions.user").delete({
          where: { id: user.id },
        });
        return ctx.badRequest("Failed to send invitation email");
      }
    } catch (error) {
      return ctx.badRequest("An error occurred while creating the invitation");
    }
  };

  // Add the new route
  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/auth/invite",
    handler: "user.invite",
    config: {
      prefix: "",
      policies: ["admin::isAuthenticatedAdmin"],
    },
  });

  return plugin;
};
