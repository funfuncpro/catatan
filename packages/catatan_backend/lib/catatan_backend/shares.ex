defmodule CatatanBackend.Shares do
  @moduledoc """
  Public module for Shares context in the CatatanBackend application.

  This module provides the public API for creating and managing shareable links
  for notes.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Shares.Create
  alias CatatanBackend.Shares.Get

  @doc """
  Creates or retrieves a shareable link for a given note.

  This function is idempotent. If a share link already exists for the
  given note, it will be returned. Otherwise, a new one will be created.
  Expected params: %{note_id: String.t(), access_type: String.t(), allowed_emails: list(String.t())}
  """
  @spec create_or_get_share(map()) :: {:ok, map(), :created | :ok} | {:error, term()}
  def create_or_get_share(%{note_id: note_id, access_type: access_type, allowed_emails: allowed_emails} = params) do
    frontend_host = Application.get_env(:catatan_backend, :frontend_host)

    with {:ok, %{"share_id" => share_id}} <- Get.by_note_id(note_id) do
      # Share link already exists
      {:ok, %{"share_id" => share_id, "url" => "#{frontend_host}/shares/#{share_id}"}, :ok}
    else
      {:error, :not_found} ->
        # No share link exists, create a new one
        with {:ok, _note} <- CatatanBackend.Notes.get_note_by_id(note_id), # Authorization check would go here if enabled
             new_share_id <- GenerateID.generate_nano_id(),
             timestamp <- DateTime.utc_now() |> DateTime.to_unix(:millisecond),
             {:ok, _share} <- Create.insert_share_batch(new_share_id, note_id, access_type, allowed_emails, timestamp) do
          {:ok, %{"share_id" => new_share_id, "url" => "#{frontend_host}/shares/#{new_share_id}"}, :created}
        else
          {:error, :not_found} ->
            {:error, :not_found} # Note does not exist

          {:error, reason} ->
            {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Retrieves a note using a share_id.
  """
  @spec get_note_by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_note_by_share_id(share_id) do
    Get.by_share_id(share_id)
  end
end
