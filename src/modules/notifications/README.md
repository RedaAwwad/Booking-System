# Notifications Module

## Overview
The **Notifications Module** is a completely decoupled subsystem responsible for handling user communications (like sending booking confirmation emails or SMS messages).

## Architecture & Event Consumption
Instead of the Flights or Hotels module directly calling a `NotificationsService` to send an email (which could slow down the HTTP request or fail and drop the email entirely), this module listens for events on a message queue.

1. The `Outbox Module` publishes an event to RabbitMQ with a specific exchange and routing key (e.g., `booking.notifications`, `email.notifications`).
2. The **Notifications Module** acts as a RabbitMQ Consumer. It binds to those queues and listens for incoming messages.
3. Upon receiving a message, it extracts the payload (recipient email, subject, body).
4. It uses `nodemailer` to dispatch the actual email to the user.

## Reliability
Because it consumes events from RabbitMQ, this module can scale independently. If the email server is temporarily down, the messages will remain safely queued in RabbitMQ and will be retried automatically until they succeed, guaranteeing that users will always receive their booking confirmations eventually.
