# Database class diagram

The whole data model from [lld.md](lld.md) as one picture. Classes are singular (`User`); the
actual tables are plural (`users`). Arrows read left to right: `User "1" --> "*" Car` means one
user owns many cars.

```mermaid
classDiagram
direction LR

  class User {
    +uuid id
    +text name
    +text photo_url
    +text phone
    +text gender
    +text upi_vpa
    +bool is_admin
    +uuid home_place_id
    +uuid work_place_id
    +int reliability_score
    +int rides_completed
    +int no_shows_90d
    +int late_cancels_90d
  }

  class Car {
    +uuid id
    +uuid owner_id
    +text model
    +text colour
    +text plate
    +int seats_total
    +List~text~ photo_paths
  }

  class Place {
    +uuid id
    +text name
    +point geo
    +PlaceKind kind
    +int use_count
  }

  class UsualRide {
    +uuid id
    +uuid owner_id
    +uuid car_id
    +time depart_time
    +int seats_offered
    +int price_per_seat
    +text notes
    +int auto_golive_days
    +jsonb stops
  }

  class Ride {
    +uuid id
    +uuid owner_id
    +uuid car_id
    +uuid usual_ride_id
    +timestamptz depart_at
    +int seats_total
    +int seats_left
    +int price_per_seat
    +text notes
    +bool women_only
    +RideStatus status
    +timestamptz allocation_at
  }

  class RideStop {
    +uuid ride_id
    +int seq
    +uuid place_id
    +point geo
    +text label
    +int eta_offset_min
  }

  class Booking {
    +uuid id
    +uuid ride_id
    +uuid rider_id
    +int pickup_seq
    +int drop_seq
    +int seats
    +bool any_car_ok
    +BookingStatus status
    +int waitlist_rank
    +timestamptz created_at
    +timestamptz decided_at
  }

  class ReliabilityEvent {
    +uuid id
    +uuid user_id
    +uuid booking_id
    +EventKind kind
    +int points
    +timestamptz created_at
    +bool disputed
    +uuid resolved_by
  }

  class Review {
    +uuid booking_id
    +uuid from_user
    +uuid to_user
    +int stars
    +text comment
  }

  class Report {
    +uuid id
    +uuid by_user
    +uuid about_user
    +uuid ride_id
    +text reason
    +ReportStatus status
  }

  class PushSubscription {
    +uuid user_id
    +text endpoint
    +text p256dh
    +text auth
  }

  class NotificationOutbox {
    +uuid id
    +uuid user_id
    +text kind
    +jsonb payload
    +OutboxStatus status
    +timestamptz created_at
  }

  class SignupToken {
    +text token
    +uuid created_by
    +int max_uses
    +int used_count
    +timestamptz expires_at
  }

  class Block {
    +uuid blocker_id
    +uuid blocked_id
  }

  class AdminAction {
    +uuid id
    +uuid admin_id
    +text action
    +uuid target_user
    +uuid target_ride
    +uuid target_report
    +text reason
    +timestamptz created_at
  }

  class RideStatus {
    <<enumeration>>
    OPEN
    ALLOCATING
    FULL
    STARTED
    COMPLETED
    CANCELLED
  }

  class BookingStatus {
    <<enumeration>>
    REQUESTED
    CONFIRMED
    WAITLISTED
    DECLINED
    CANCELLED
    EXPIRED
    COMPLETED
    NO_SHOW
  }

  class EventKind {
    <<enumeration>>
    COMPLETED
    NO_SHOW
    LATE_CANCEL
    OWNER_LATE_CANCEL
  }

  User "1" --> "*" Car : owns
  User "1" --> "*" UsualRide : saves
  Car "1" --> "*" UsualRide : used in
  UsualRide "1" --> "*" Ride : go live
  User "1" --> "*" Ride : offers
  Car "1" --> "*" Ride : drives
  Ride "1" *-- "2..*" RideStop : route
  Place "1" --> "*" RideStop : names
  User "*" --> "0..1" Place : home / work
  Ride "1" --> "*" Booking : fills
  User "1" --> "*" Booking : rides as rider
  Booking "1" --> "*" ReliabilityEvent : produces
  User "1" --> "*" ReliabilityEvent : scored by
  Booking "1" --> "0..2" Review : after ride
  User "1" --> "*" Report : files / is about
  User "1" --> "*" PushSubscription : devices
  User "1" --> "*" NotificationOutbox : pending pushes
  User "1" --> "*" SignupToken : invites with
  User "1" --> "*" Block : blocks
  User "1" --> "*" AdminAction : performs (admin)

  Ride ..> RideStatus
  Booking ..> BookingStatus
  ReliabilityEvent ..> EventKind
```

## What the picture can't show

Rules that live in the schema but not in boxes and arrows:

| Rule | Where | Why |
|---|---|---|
| `UNIQUE(usual_ride_id, depart_at)` | Ride | Auto go-live run twice still creates one ride per day |
| `UNIQUE(ride_id, rider_id)` where status in REQUESTED / CONFIRMED / WAITLISTED | Booking | One active booking per rider per ride |
| `PRIMARY KEY(ride_id, seq)` | RideStop | Stops are ordered; `d.seq > p.seq` in search needs this |
| `seats_left >= 0`, changed only by the conditional UPDATE | Ride | The last-seat guarantee ([lld.md §2](lld.md#2-the-last-seat)) |
| `pickup_seq < drop_seq` check | Booking | You can't ride backwards |
| GiST index on `geo` | RideStop, Place | Makes the 2 km proximity search fast |
| Score columns on User are a cached rollup of ReliabilityEvent | User | The events are the truth; the daily job recomputes ([lld.md §3](lld.md#3-reliability-score)) |
| Row-Level Security: phone / plate / photos readable only within a confirmed booking | User, Car | Privacy by default (D12) |

## How to read it against the flows

- **One-time setup** writes `User`, `Car`, `UsualRide` — and never again (D7).
- **The evening tap** copies `UsualRide` into `Ride` + `RideStop` rows (F-B2).
- **Booking life** is one `Booking` row changing status, with every change to seats going
  through `Ride.seats_left` in the same transaction (F-D5).
- **The score** is append-only `ReliabilityEvent` rows; nothing ever edits history, disputes
  just mark an event void (F-F3 to F-F5).
- **`NotificationOutbox`** is written in the same transaction as the change it announces, then
  drained by the push sender — so a crash can't lose a "you're confirmed" (lld.md §6).
