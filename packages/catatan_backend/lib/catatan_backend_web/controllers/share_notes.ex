defmodule CatatanBackendWeb.SharesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.SharesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Shares
  alias CatatanBackend.Notes

  @moduledoc """
  Controller for handling share-related API requests.
  """

  action_fallback CatatanBackendWeb.FallbackController

  @doc """
  Creates or retrieves a shareable link for a note.
  Requires authentication and ownership of the note.
  """
  def create(conn, params) do
    current_user = conn.assigns[:current_user]
    user_id = if current_user, do: current_user.user_id, else: nil
    require Logger

    with {:ok, validated_params} <- SharesValidator.validate_share_creation(params) do
      note_id = validated_params.note_id
      Logger.info("SharesController: Attempting to share note_id: #{inspect(note_id)}")

      # Security Check: Unauthenticated users cannot create PRIVATE shares
      if is_nil(current_user) and validated_params.access_type == "private" do
        conn
        |> put_status(:forbidden)
        |> Response.error_response("Unauthenticated users cannot create private shares", %{})
      else
        case Notes.get_note_by_id(note_id) do
          {:ok, note} ->
            # Check Ownership:
            # 1. Authenticated: note.owner_id must match user_id
            # 2. Anonymous: note.owner_id must be nil (and user_id is nil)
            if note["owner_id"] == user_id do
              with {:ok, share, status} <- Shares.create_or_get_share(validated_params) do
                conn
                |> put_status(status)
                |> Response.success_response("Share link processed successfully", share)
              else
                {:error, reason} ->
                  conn
                  |> put_status(:internal_server_error)
                  |> Response.error_response("Internal server error", %{reason: inspect(reason)})
              end
            else
              conn
              |> put_status(:forbidden)
              |> Response.error_response("You are not the owner of this note", %{})
            end

          {:error, :not_found} ->
            Logger.error("SharesController: Note not found for id: #{inspect(note_id)}")
            conn
            |> put_status(:not_found)
            |> Response.error_response("Note with the given ID not found", %{})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{reason: inspect(reason)})
        end
      end
    else
      {:error, errors} when is_list(errors) or is_map(errors) ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  @doc """
  Retrieves a note using a share_id.
  Enforces access control for private shares.
  """
  def show(conn, %{"id" => share_id}) do
    case SharesValidator.validate_share_retrieval(%{share_id: share_id}) do
      {:ok, _validated_data} ->
        with {:ok, share_metadata} <- Shares.get_share_with_metadata(share_id) do
          if authorized_to_view?(share_metadata, conn.assigns[:current_user]) do
            with {:ok, note} <- Shares.get_note_by_share_id(share_id) do
              response_data =
                Map.put(
                  note,
                  "permission_level",
                  Map.get(share_metadata, "permission_level", "read")
                )

              Response.success_response(conn, "success", response_data)
            else
              {:error, reason} ->
                conn
                |> put_status(:internal_server_error)
                |> Response.error_response("Internal server error", %{reason: inspect(reason)})
            end
          else
            conn
            |> put_status(:forbidden)
            |> Response.error_response("You do not have permission to view this shared note", %{})
          end
        else
          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Share link not found", %{})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Internal server error", %{reason: inspect(reason)})
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  defp authorized_to_view?(share_metadata, current_user) do
    access_type = Map.get(share_metadata, "access_type")

    case access_type do
      "public" ->
        true

      "private" ->
        allowed_emails = Map.get(share_metadata, "allowed_emails", []) || []

        if current_user do
          current_user.email in allowed_emails
        else
          false
        end

      _ ->
        false
    end
  end
end
