defmodule CatatanBackendWeb.ProfileController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.Response

  @moduledoc """
  Controller for authenticated user profile.
  """

  action_fallback CatatanBackendWeb.FallbackController

  @doc """
  Returns the current authenticated user's profile.
  Requires authentication via AuthPlug.
  """
  def show(conn, _params) do
    # current_user is assigned by AuthPlug
    current_user = conn.assigns[:current_user]

    Response.success_response(conn, "Profile retrieved successfully", %{
      user: %{
        user_id: current_user.user_id,
        email: current_user.email,
        external_id: current_user.external_id
      }
    })
  end
end
