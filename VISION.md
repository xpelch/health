# Health Project Vision

Health is an open-source public-good project for collecting health and activity
data from supported watches without making one device vendor the center of the
system.

## Mission

Give people and developers a transparent, portable, and reusable foundation for
working with their own health data. The project should reduce structural
dependence on closed ecosystems while being honest about the platform APIs that
remain necessary to access device data.

## Principles

- **User control:** people can understand which data is accessed, why it is
  accessed, where it is stored, and how to remove it.
- **Local first:** the MVP keeps health data on the phone and requires no
  account or remote service.
- **Portability:** normalized records can be exported through documented,
  replaceable destinations.
- **Vendor neutrality:** Apple, Google, and device-provider concepts remain in
  adapters instead of the core domain.
- **Interoperability:** use documented schemas and official APIs instead of
  opaque protocols.
- **Modularity:** sources, destinations, identity providers, and client
  experiences can evolve independently.
- **Reuse:** the aggregation and synchronization core can support personal
  dashboards, wellness tools, consented research, coaching, accessibility, and
  specialized forks.
- **Privacy:** collect, retain, and expose only what a selected use case needs.
- **Honesty:** do not claim universal device support, medical accuracy, or
  independence from an API that the project still relies on.

## What public good means here

The source, contracts, decisions, and extension points are public and designed
to remain understandable and forkable. Public good does not mean that every
external API, hosted deployment, app-store account, or infrastructure provider
is free.

HealthKit, Health Connect, and future provider APIs are unavoidable boundaries
for some devices. Health contains those dependencies behind replaceable
adapters and keeps the normalized model independent from their payload formats.

## Product boundary

The first product is a mobile application that imports four categories of
records:

- steps;
- heart rate;
- sleep;
- workouts.

The MVP stores records locally and does not require an account. Remote storage,
provider-specific integrations, and authentication are extension points rather
than prerequisites.

Health is not a medical device and must not be used to make medical decisions.

## Further reading

- [MVP product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Extensibility](docs/extensibility.md)
- [Privacy and security](docs/privacy-and-security.md)
