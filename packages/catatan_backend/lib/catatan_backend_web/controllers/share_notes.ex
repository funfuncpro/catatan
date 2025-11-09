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
  Creates a shareable link for a note.
  """
  def create(conn, _params) do
    case Map.get(conn.assigns, :session_id) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> Response.error_response("No valid session found", %{})

      session_id ->
        case Sessions.get_note_id(session_id) do
          {:ok, note_id} ->
            case Shares.create_share(note_id) do
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
  Retrieves a note using a share_id.
  """
  def show(conn, %{"id" => share_id}) do
    case SharesValidator.validate_share_retrieval(%{share_id: share_id}) do
      {:ok, _validated_data} ->
        case Shares.get_note_by_share_id(share_id) do
          {:ok, note} ->
            Response.success_response(conn, "success", note)

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> Response.error_response("Share link not found", %{})

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
end
