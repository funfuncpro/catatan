defmodule CatatanBackend.Notes.Lww do
  @moduledoc """
  Version-based Last-Write-Wins (LWW) register for note content.

  This is a *pure* CRDT core:
  - `assign/4` sets a new value at (replica_id, clock)
  - `merge/2` picks the winner by (clock, replica_id)

  The `last_updated` field stores the wall-clock timestamp for debugging and
  monitoring purposes. It is not used in merge semantics (only logical clock matters).
  """

  @type t :: %__MODULE__{
          content: String.t(),
          clock: non_neg_integer(),
          replica_id: term(),
          last_updated: DateTime.t()
        }

  defstruct [:content, :clock, :replica_id, :last_updated]

  @doc """
  Create a new LWW state.

  `clock` should start at 0 for a fresh replica.
  """
  @spec new(String.t(), term(), non_neg_integer()) :: t
  def new(content \\ "", replica_id, clock \\ 0) do
    %__MODULE__{
      content: content,
      clock: clock,
      replica_id: replica_id,
      last_updated: DateTime.utc_now()
    }
  end

  @doc """
  Assign a new content value at the given (replica_id, clock).

  Returns `{:ok, state}` if the clock is valid (monotonically increasing),
  or `{:error, :clock_regression}` if the new clock is not greater than the current clock
  when updating the same replica.
  """
  @spec assign(t | nil, term(), non_neg_integer(), String.t()) ::
          {:ok, t} | {:error, :clock_regression}
  def assign(nil, replica_id, clock, content) do
    {:ok, new(content, replica_id, clock)}
  end

  def assign(
        %__MODULE__{clock: prev_clock, replica_id: prev_replica} = _prev,
        replica_id,
        clock,
        _content
      )
      when replica_id == prev_replica and clock <= prev_clock do
    {:error, :clock_regression}
  end

  def assign(%__MODULE__{}, replica_id, clock, content) do
    {:ok,
     %__MODULE__{
       content: content,
       clock: clock,
       replica_id: replica_id,
       last_updated: DateTime.utc_now()
     }}
  end

  @doc """
  Merge two LWW states using (clock, replica_id) order.

  Deterministic: all replicas will pick the same winner.
  """
  @spec merge(t, t) :: t
  def merge(%__MODULE__{} = a, %__MODULE__{} = b) do
    case compare(a, b) do
      :gt ->
        a

      :lt ->
        b

      :eq ->
        # Clocks are equal, use replica_id as deterministic tie-breaker
        # This ensures all replicas pick the same winner when clocks match
        if a.replica_id >= b.replica_id, do: a, else: b
    end
  end

  @doc """
  Read the content value.
  """
  @spec value(t) :: String.t()
  def value(%__MODULE__{content: c}), do: c

  @doc """
  Get the current logical clock.
  """
  @spec current_clock(t) :: non_neg_integer()
  def current_clock(%__MODULE__{clock: c}), do: c

  @doc """
  Optional: optimistic update helper.

  Only applies update if client_clock == current clock.
  This is *not* required for CRDT semantics, it is just a guard.
  """
  @spec optimistic_update(t, term(), non_neg_integer(), String.t()) ::
          {:ok, t} | {:error, :stale | :invalid | :clock_regression, t}
  def optimistic_update(%__MODULE__{} = note, replica_id, client_clock, new_content) do
    current = note.clock

    cond do
      client_clock < current ->
        {:error, :stale, note}

      client_clock == current ->
        case assign(note, replica_id, current + 1, new_content) do
          {:ok, updated} -> {:ok, updated}
          {:error, :clock_regression} -> {:error, :clock_regression, note}
        end

      client_clock > current ->
        {:error, :invalid, note}
    end
  end

  # --- internal ---

  defp compare(%__MODULE__{clock: ca}, %__MODULE__{clock: cb}) when ca > cb, do: :gt
  defp compare(%__MODULE__{clock: ca}, %__MODULE__{clock: cb}) when ca < cb, do: :lt
  defp compare(_a, _b), do: :eq
end
