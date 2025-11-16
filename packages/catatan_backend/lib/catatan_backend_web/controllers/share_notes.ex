defmodule CatatanBackendWeb.SharesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.SharesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Shares
  alias CatatanBackend.Sessions

  @moduledoc """
  Controller for handling share-related API requests.
  """

  action_fallback CatatanBackendWeb.FallbackController

  @doc """
  Creates a shareable link for a note with optional access control.

  ## Request body:
  - access_type: "public" or "restricted" (optional, defaults to "public")
  - allowed_emails: List of email addresses (required if access_type is "restricted")
  """
  def create(conn, params) do
    case Map.get(conn.assigns, :session_id) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> Response.error_response("No valid session found", %{})

      session_id ->
        case Sessions.get_note_id(session_id) do
          {:ok, note_id} ->
            # Extract optional access control parameters
            access_type = Map.get(params, "access_type", "public")
            allowed_emails = Map.get(params, "allowed_emails", [])

            # Get user_id from conn.assigns (set by AuthPlug if authenticated)
            user_id = Map.get(conn.assigns, :user_id)

            case Shares.create_share(note_id, access_type, allowed_emails, user_id) do
              {:ok, share} ->
                conn
                |> put_status(:created)
                |> Response.success_response("Share link created successfully", share)

              {:error, :not_found} ->
                conn
                |> put_status(:not_found)
                |> Response.error_response("Note not found", %{})

              {:error, _reason} ->
                conn
                |> put_status(:internal_server_error)
                |> Response.error_response("Internal server error", %{})
            end

          {:error, :not_found} ->
            conn
            |> put_status(:unauthorized)
            |> Response.error_response("Invalid session", %{})

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{})
        end
    end
  end

  @doc """
  Retrieves a note using a share_id with authorization check.
  Public shares can be accessed by anyone.
  Restricted shares require authentication and email whitelist membership.
  """
  def show(conn, %{"id" => share_id}) do
    IO.puts("\n=== SHARES CONTROLLER SHOW ===")
    IO.puts("Share ID: #{inspect(share_id)}")
    IO.puts("Current user from conn.assigns: #{inspect(Map.get(conn.assigns, :current_user))}")
    IO.puts("==============================\n")

    case SharesValidator.validate_share_retrieval(%{share_id: share_id}) do
      {:ok, _validated_data} ->
        # Get current user from conn.assigns (nil if not authenticated)
        current_user = Map.get(conn.assigns, :current_user)

        case Shares.get_note_by_share_id(share_id, current_user) do
          {:ok, note} ->
            Response.success_response(conn, "success", note)

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Share link not found", %{})

          {:error, :unauthorized} ->
            conn
            |> put_status(:forbidden)
            |> Response.error_response(
              "Access denied. This share is restricted to authorized users.",
              %{}
            )

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{})
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  @doc """
  Retrieves share metadata including access control settings.
  Requires authentication and ownership verification.
  """
  def info(conn, %{"id" => share_id}) do
    current_user = Map.get(conn.assigns, :current_user)

    case current_user do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> Response.error_response("Authentication required", %{})

      user ->
        case Shares.get_share_info(share_id) do
          {:ok, share} ->
            # Verify user is the creator (if created_by is set)
            created_by = Map.get(share, "created_by")

            if is_nil(created_by) or created_by == Map.get(user, "user_id") do
              Response.success_response(conn, "success", share)
            else
              conn
              |> put_status(:forbidden)
              |> Response.error_response("Access denied", %{})
            end

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Share not found", %{})

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{})
        end
    end
  end

  @doc """
  Updates access control settings for a share.
  Requires authentication and ownership verification.

  ## Request body:
  - access_type: "public" or "restricted"
  - allowed_emails: List of email addresses (optional, only used for restricted)
  """
  def update_permissions(conn, %{"id" => share_id} = params) do
    current_user = Map.get(conn.assigns, :current_user)

    case current_user do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> Response.error_response("Authentication required", %{})

      user ->
        # Verify ownership
        case Shares.get_share_info(share_id) do
          {:ok, share} ->
            created_by = Map.get(share, "created_by")

            if is_nil(created_by) or created_by == Map.get(user, "user_id") do
              # Extract parameters
              access_type = Map.get(params, "access_type")
              allowed_emails = Map.get(params, "allowed_emails", [])

              case Shares.update_share_permissions(share_id, access_type, allowed_emails) do
                :ok ->
                  Response.success_response(conn, "Permissions updated successfully", %{})

                {:error, :not_found} ->
                  conn
                  |> put_status(:not_found)
                  |> Response.error_response("Share not found", %{})

                {:error, _reason} ->
                  conn
                  |> put_status(:internal_server_error)
                  |> Response.error_response("Internal server error", %{})
              end
            else
              conn
              |> put_status(:forbidden)
              |> Response.error_response("Access denied", %{})
            end

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Share not found", %{})

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{})
        end
    end
  end
end
