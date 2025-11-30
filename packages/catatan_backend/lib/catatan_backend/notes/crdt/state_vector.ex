defmodule CatatanBackend.Notes.Crdt.StateVector do
  @moduledoc """
  Tracks what operations have been seen from each writer.
  """

  @type t :: %{String.t() => integer()}

  @spec initialize() :: t
  def initialize, do: %{}

  @spec update(t, String.t(), integer()) :: t
  def update(sv, writer_id, clock) do
    Map.update(sv, writer_id, clock, &max(&1, clock))
  end

  @spec has_seen?(t, String.t(), integer()) :: boolean()
  def has_seen?(sv, writer_id, clock) do
    Map.get(sv, writer_id, 0) >= clock
  end

  @spec missing(t, t) :: [{String.t(), integer(), integer()}]
  def missing(ours, theirs) do
    Enum.flat_map(theirs, fn {writer_id, their_clock} ->
      our_clock = Map.get(ours, writer_id, 0)

      if their_clock > our_clock do
        [{writer_id, our_clock + 1, their_clock}]
      else
        []
      end
    end)
  end

  @spec merge(t, t) :: t
  def merge(sv1, sv2) do
    Map.merge(sv1, sv2, fn _k, v1, v2 -> max(v1, v2) end)
  end
end
