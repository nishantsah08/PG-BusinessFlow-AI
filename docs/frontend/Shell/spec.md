# Shell Specification

## Purpose
Provides the overarching layout scaffolding for the authenticated portion of the application. It composes the screen out of a horizontal top bar, a vertical side navigation, and a dynamic main content area.

Application-wide form and popup behavior follows [form_and_popup_policy.md](../form_and_popup_policy.md).

## Layout Structure
- **Global Container**: Forces a `100vh` flex-column to prohibit the body from scrolling entirely.
- **Top Row**: Renders the `<TopBar />`.
- **Bottom Row**: A flex-row container holding the `<Sidebar />` on the left, and a `<main>` container on the right.
- **Main View**: Uses `<Outlet />` to render the active React Router page. This container natively handles its own inner overflow tracking.

## Dependencies
- `react-router-dom`: Utilizes standard `<Outlet />` for sub-route injection.
