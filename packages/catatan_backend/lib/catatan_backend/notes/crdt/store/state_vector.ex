defmodule CatatanBackend.Notes.Crdt.Store.StateVector do
  @moduledoc """
  Tracks what operations seen from each site.
  """

  @type t :: %__MODULE__{
          note_id: String.t(),
          site_id: String.t(),
          clock: integer(),
          updated_at: DateTime.t()
        }

  @derive Jason.Encoder
  defstruct [:note_id, :site_id, :clock, :updated_at]

  @spec initialize(String.t(), String.t(), integer()) :: t
  def initialize(note_id, site_id, clock \\ 0) do
    %__MODULE__{
      note_id: note_id,
      site_id: site_id,
      clock: clock,
      updated_at: DateTime.utc_now()
    }
  end

  def initialize(), do: [:error, :missing_arguments]

  @spec increment_clock(t) :: t
  def increment_clock(%__MODULE__{clock: clock} = state) do
    %{state | clock: clock + 1, updated_at: DateTime.utc_now()}
  end
end
