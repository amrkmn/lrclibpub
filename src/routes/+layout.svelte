<script lang="ts">
    import "../app.css";
    export const prerender = true;
    export const ssr = false;
    let { children } = $props();
</script>

{@render children()}
