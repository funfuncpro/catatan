defmodule CatatanBackend.Notes.NoteCrdt do
  @moduledoc """
  CRDT representation of a Note in the CatatanBackend application.
  """

  alias CatatanBackend.Notes.Lww

  @type t :: %__MODULE__{
          note_id: String.t(),
          content: Lww.t()
        }

  defstruct [:note_id, :content]

  @doc """
  Create a new NoteCrdt with empty content.
  """

  @spec new(String.t(), term()) :: t
  def new(note_id, replica_id) do
    %__MODULE__{
      note_id: note_id,
      content: Lww.new("", replica_id, 0)
    }
  end

  @doc """
  Set the body of the note using LWW assign.

  Returns `{:ok, updated_note}` if successful,
  or `{:error, :clock_regression}` if the clock is not monotonically increasing.
  """
  @spec set_body(t, term(), non_neg_integer(), String.t()) ::
          {:ok, t} | {:error, :clock_regression}
  def set_body(
        %__MODULE__{
          content: reg
        } = note,
        replica_id,
        clock,
        new_content
      ) do
    case Lww.assign(reg, replica_id, clock, new_content) do
      {:ok, updated_content} -> {:ok, %{note | content: updated_content}}
      {:error, :clock_regression} -> {:error, :clock_regression}
    end
  end

  @doc """
  Merge two NoteCrdt instances.

  Returns `{:ok, merged_note}` if both notes have the same note_id,
  or `{:error, :mismatched_ids}` if the note_ids differ.
  """
  @spec merge(t, t) :: {:ok, t} | {:error, :mismatched_ids}
  def merge(
        %__MODULE__{
          note_id: note_id,
          content: content_a
        },
        %__MODULE__{
          note_id: note_id,
          content: content_b
        }
      ) do
    {:ok,
     %__MODULE__{
       note_id: note_id,
       content: Lww.merge(content_a, content_b)
     }}
  end

  def merge(%__MODULE__{}, %__MODULE__{}) do
    {:error, :mismatched_ids}
  end

  @doc """
  Read the body of the note.
  """
  @spec get_body(t) :: String.t()
  def get_body(%__MODULE__{content: content}) do
    Lww.value(content)
  end

  @doc """
  Current Logical Clock of the note.
  """
  @spec current_clock(t) :: non_neg_integer()
  def current_clock(%__MODULE__{content: content}) do
    Lww.current_clock(content)
  end

  @doc """
  Optimistically update the note content.

  Only applies update if client_clock matches the current clock.
  Returns `{:ok, updated_note}` on success, or an error tuple on failure.
  """
  @spec optimistic_update(t, term(), non_neg_integer(), String.t()) ::
          {:ok, t} | {:error, :stale | :invalid | :clock_regression, t}
  def optimistic_update(
        %__MODULE__{content: content} = note,
        replica_id,
        client_clock,
        new_content
      ) do
    case Lww.optimistic_update(content, replica_id, client_clock, new_content) do
      {:ok, updated_content} ->
        {:ok, %{note | content: updated_content}}

      {:error, reason, unchanged_content} ->
        {:error, reason, %{note | content: unchanged_content}}
    end
  end

  @doc """
  Get the replica_id of the note (for debugging).
  """
  @spec get_replica_id(t) :: term()
  def get_replica_id(%__MODULE__{content: %Lww{replica_id: replica_id}}) do
    replica_id
  end
end
