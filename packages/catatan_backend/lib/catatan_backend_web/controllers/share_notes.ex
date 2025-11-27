defmodule CatatanBackendWeb.SharesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.SharesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Shares

  @moduledoc """
  Controller for handling share-related API requests.
  """

  action_fallback CatatanBackendWeb.FallbackController

  @doc """
  Creates or retrieves a shareable link for a note.

  This endpoint is idempotent. If a share link already exists for the
  given note, it will be returned. Otherwise, a new one will be created.
  """
  def create(conn, params) do
    with {:ok, validated_params} <- SharesValidator.validate_share_creation(params),
         {:ok, share, status} <- Shares.create_or_get_share(validated_params) do
      conn
      |> put_status(status)
      |> Response.success_response("Share link processed successfully", share)
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> Response.error_response("Note with the given ID not found", %{})

      {:error, errors} when is_list(errors) or is_map(errors) ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("Internal server error", %{reason: inspect(reason)})
    end
  end

  @doc """
  Retrieves a note using a share_id.
  """
  def show(conn, %{"id" => share_id}) do
    case SharesValidator.validate_share_retrieval(%{share_id: share_id}) do
      {:ok, _validated_data} ->
        with {:ok, share_metadata} <- Shares.get_share_with_metadata(share_id),
             {:ok, note} <- Shares.get_note_by_share_id(share_id) do
          # Add permission_level to response
          response_data =
            Map.put(note, "permission_level", Map.get(share_metadata, "permission_level", "read"))

          Response.success_response(conn, "success", response_data)
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
end
