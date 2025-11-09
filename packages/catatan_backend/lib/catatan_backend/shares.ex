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
  Creates a shareable link for a given note.
  """
  @spec create_share(String.t()) :: {:ok, map()} | {:error, term()}
  def create_share(note_id) do
    case CatatanBackend.Notes.get_note_by_id(note_id) do
      {:ok, _note} ->
        Create.insert_share(
          note_id,
          GenerateID.generate_nano_id(),
          DateTime.utc_now() |> DateTime.to_unix(:millisecond)
        )

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
